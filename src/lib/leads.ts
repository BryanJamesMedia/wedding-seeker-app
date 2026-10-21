import "server-only";
import { query, queryOne, withTransaction } from "@/db";
import type { ListingType } from "./categories";

export const DEFAULT_LEAD_PRICE_CENTS = 500;

/** Wedding details as saved on the connection request (see createConnection). */
export type LeadSnapshot = {
  partner1_name?: string | null;
  partner2_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  wedding_date?: string | null;
  target_month?: number | null;
  target_year?: number | null;
  when?: string | null;
  location_text?: string | null;
  guest_count?: number | null;
  budget_range?: string | null;
  settings?: string[];
  vibe?: string | null;
  vendors_needed?: string[];
};

export type Lead = {
  id: string;
  listing_type: ListingType;
  listing_id: string;
  listing_name: string;
  category: string | null;
  created_at: Date;
  snapshot: LeadSnapshot;
  message: string | null;
  price_cents: number;
  purchased_at: Date | null;
  /** Only set once the lead is purchased. */
  contact: { email: string | null; phone: string | null } | null;
};

/** SQL for the current price of a lead on listing `l`: category price, then the type's '*' price, then the default. */
const PRICE_SQL = `coalesce(
  (SELECT p.price_cents FROM lead_prices p WHERE l.listing_type = 'vendor' AND p.listing_type = 'vendor' AND p.category = lower(btrim(l.category))),
  (SELECT p.price_cents FROM lead_prices p WHERE p.listing_type = l.listing_type AND p.category = '*'),
  ${DEFAULT_LEAD_PRICE_CENTS})`;

// Requests to listings the vendor owns (approved claim). Requests from deleted couple accounts can't be bought.
const LEADS_SQL = `
  SELECT c.id, c.listing_type, c.listing_id, l.name AS listing_name, l.category, c.created_at,
    c.wedding_snapshot AS snapshot, c.message, coalesce(p.price_cents, ${PRICE_SQL}) AS price_cents,
    p.created_at AS purchased_at, coalesce(nullif(c.wedding_snapshot->>'contact_email', ''), u.email) AS contact_email
  FROM connection_requests c
  JOIN listing_claims o ON o.listing_type = c.listing_type AND o.listing_id = c.listing_id AND o.status = 'approved' AND o.user_id = $1
  JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
  LEFT JOIN lead_purchases p ON p.request_id = c.id
  LEFT JOIN users u ON u.id = c.user_id
  WHERE ((p.id IS NULL AND c.user_id IS NOT NULL) OR p.user_id = $1)`;

type LeadRow = Omit<Lead, "contact"> & { contact_email: string | null };

/** Couple email and phone are only ever returned for purchased leads. */
function toLead({ contact_email, ...row }: LeadRow): Lead {
  const { contact_email: _e, contact_phone, ...rest } = row.snapshot ?? {};
  void _e;
  return {
    ...row,
    snapshot: row.purchased_at ? row.snapshot : rest,
    contact: row.purchased_at ? { email: contact_email, phone: contact_phone ?? null } : null,
  };
}

export async function listLeads(userId: string, purchased: boolean): Promise<Lead[]> {
  const rows = await query<LeadRow>(
    `${LEADS_SQL} AND (p.id IS NOT NULL) = $2 ORDER BY coalesce(p.created_at, c.created_at) DESC`,
    [userId, purchased],
  );
  return rows.map(toLead);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getLead(userId: string, requestId: string): Promise<Lead | null> {
  if (!UUID.test(requestId)) return null;
  const row = await queryOne<LeadRow>(`${LEADS_SQL} AND c.id = $2`, [userId, requestId]);
  return row ? toLead(row) : null;
}

export async function countLeads(userId: string): Promise<{ open: number; purchased: number }> {
  const [row] = await query<{ open: number; purchased: number }>(
    `SELECT count(*) FILTER (WHERE purchased_at IS NULL)::int AS open, count(*) FILTER (WHERE purchased_at IS NOT NULL)::int AS purchased
     FROM (${LEADS_SQL}) t`,
    [userId],
  );
  return row;
}

export async function getBalance(userId: string): Promise<number> {
  const row = await queryOne<{ balance: number }>(
    "SELECT coalesce(sum(amount_cents), 0)::int AS balance FROM wallet_transactions WHERE user_id = $1",
    [userId],
  );
  return row?.balance ?? 0;
}

/** Current price of a lead for a listing, in cents. */
export async function leadPrice(listingType: ListingType, category: string | null): Promise<number> {
  const row = await queryOne<{ price: number }>(
    `SELECT ${PRICE_SQL} AS price FROM (SELECT $1::text AS listing_type, $2::text AS category) l`,
    [listingType, category],
  );
  return row?.price ?? DEFAULT_LEAD_PRICE_CENTS;
}

export type PurchaseResult =
  | { ok: true; alreadyOwned: boolean; priceCents: number }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "insufficient_funds"; priceCents: number; balanceCents: number };

/**
 * Buys a lead from the vendor's wallet. Locks the vendor's user row so two purchases
 * can't spend the same balance, and request_id is unique so a lead is bought once.
 */
export async function purchaseLead(userId: string, requestId: string): Promise<PurchaseResult> {
  if (!UUID.test(requestId)) return { ok: false, code: "not_found" };
  return withTransaction(async (db) => {
    await db.query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const { rows: [lead] } = await db.query<{ price_cents: number; purchased_at: Date | null; listing_name: string }>(
      `${LEADS_SQL} AND c.id = $2`,
      [userId, requestId],
    );
    if (!lead) return { ok: false, code: "not_found" };
    if (lead.purchased_at) return { ok: true, alreadyOwned: true, priceCents: lead.price_cents };
    const { rows: [{ balance }] } = await db.query<{ balance: number }>(
      "SELECT coalesce(sum(amount_cents), 0)::int AS balance FROM wallet_transactions WHERE user_id = $1",
      [userId],
    );
    if (balance < lead.price_cents) {
      return { ok: false, code: "insufficient_funds", priceCents: lead.price_cents, balanceCents: balance };
    }
    const { rows: [purchase] } = await db.query<{ id: string }>(
      "INSERT INTO lead_purchases (request_id, user_id, price_cents) VALUES ($1, $2, $3) ON CONFLICT (request_id) DO NOTHING RETURNING id",
      [requestId, userId, lead.price_cents],
    );
    if (!purchase) return { ok: false, code: "not_found" };
    if (lead.price_cents > 0) {
      await db.query(
        "INSERT INTO wallet_transactions (user_id, amount_cents, kind, description, lead_purchase_id) VALUES ($1, $2, 'purchase', $3, $4)",
        [userId, -lead.price_cents, `Lead purchase · ${lead.listing_name}`, purchase.id],
      );
    }
    // Purchasing is the vendor saying "interested", even if an old email link said otherwise.
    await db.query(
      `UPDATE connection_requests SET status = 'responded_interested', responded_at = coalesce(responded_at, now()), updated_at = now()
       WHERE id = $1`,
      [requestId],
    );
    await db.query("INSERT INTO connection_events (request_id, type, detail) VALUES ($1, 'purchased', $2)", [
      requestId,
      JSON.stringify({ vendor: userId }),
    ]);
    return { ok: true, alreadyOwned: false, priceCents: lead.price_cents };
  });
}
