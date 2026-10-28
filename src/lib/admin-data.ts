import "server-only";
import { query, queryOne } from "@/db";
import { categoryLabel } from "@/lib/categories";
import { STATUS_LABELS, weddingWhen } from "@/lib/connections";
import type { LeadSnapshot } from "@/lib/leads";
import { listingHref } from "@/lib/search";
import { missingWeddingFields } from "@/lib/wedding-requirements";

export type Cell = string | number | boolean | null;
export type TableRow = Record<string, Cell>;
export type ReviewStatus = "pending" | "approved" | "rejected" | "all";

const LIMIT = 5000;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const typeLabel = (listingType: string | null, category: string | null) =>
  listingType === "venue" ? "Venue" : category ? categoryLabel(category) : "Vendor";
const place = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ") || null;
const pad = (n: number) => String(n).padStart(2, "0");
const whenSort = (p: { wedding_date?: string | null; target_month?: number | null; target_year?: number | null }) =>
  p.wedding_date ?? (p.target_year ? `${p.target_year}-${pad(p.target_month ?? 12)}-01` : null);
const coupleNames = (s: LeadSnapshot | null | undefined) => [s?.partner1_name, s?.partner2_name].filter(Boolean).join(" & ");
const publicHref = (l: { listing_type: string | null; category: string | null; city: string | null; state: string | null; slug: string | null; listing_status?: string | null }) =>
  l.slug && l.listing_type && (l.listing_status ?? "active") === "active" ? listingHref({ ...l, listing_type: l.listing_type, slug: l.slug }) : null;

export function parseReviewStatus(v: unknown): ReviewStatus {
  return v === "approved" || v === "rejected" || v === "all" ? v : "pending";
}

/** Claims that came from "Request to Add" are reviewed with their add request instead. */
const NOT_ADD_REQUEST = `NOT EXISTS (SELECT 1 FROM listing_requests r WHERE r.user_id = c.user_id AND r.listing_type = c.listing_type AND r.listing_id = c.listing_id)`;

export async function getOverview() {
  const [stats, series, topSearches] = await Promise.all([
    queryOne<Record<string, number>>(
      `SELECT (SELECT count(*)::int FROM users WHERE account_type = 'couple' AND deleted_at IS NULL) AS couples,
              (SELECT count(*)::int FROM users WHERE account_type = 'vendor' AND deleted_at IS NULL) AS vendors,
              (SELECT count(*)::int FROM listing_claims c WHERE status = 'pending' AND ${NOT_ADD_REQUEST}) AS pending_claims,
              (SELECT count(*)::int FROM listing_requests WHERE status = 'pending') AS pending_adds,
              (SELECT count(*)::int FROM connection_requests) AS connections,
              (SELECT count(*)::int FROM connection_requests WHERE created_at > now() - interval '30 days') AS connections_30d,
              (SELECT count(*)::int FROM lead_purchases) AS leads,
              (SELECT coalesce(sum(price_cents), 0)::int FROM lead_purchases) AS lead_revenue,
              (SELECT coalesce(sum(amount_cents), 0)::int FROM wallet_transactions WHERE kind = 'top_up') AS top_ups,
              (SELECT count(*)::int FROM search_logs WHERE created_at > now() - interval '7 days') AS searches_7d`,
    ),
    query<{ day: string; couples: number; vendors: number; connections: number }>(
      `WITH days AS (
         SELECT generate_series((now() AT TIME ZONE 'America/New_York')::date - 29, (now() AT TIME ZONE 'America/New_York')::date, interval '1 day')::date AS day
       )
       SELECT d.day::text AS day,
         (SELECT count(*)::int FROM users u WHERE u.account_type = 'couple' AND (u.created_at AT TIME ZONE 'America/New_York')::date = d.day) AS couples,
         (SELECT count(*)::int FROM users u WHERE u.account_type = 'vendor' AND (u.created_at AT TIME ZONE 'America/New_York')::date = d.day) AS vendors,
         (SELECT count(*)::int FROM connection_requests c WHERE (c.created_at AT TIME ZONE 'America/New_York')::date = d.day) AS connections
       FROM days d ORDER BY d.day`,
    ),
    query<{ q: string; n: number }>(
      `SELECT concat_ws(' · ', nullif(array_to_string(categories, ', '), ''), location_text) AS q, count(*)::int AS n
       FROM search_logs WHERE created_at > now() - interval '30 days'
       GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    ),
  ]);
  return { stats: stats!, series, topSearches };
}

export async function pendingCounts(): Promise<{ claims: number; adds: number; inbox: number }> {
  const row = await queryOne<{ claims: number; adds: number; inbox: number }>(
    `SELECT (SELECT count(*)::int FROM listing_claims c WHERE status = 'pending' AND ${NOT_ADD_REQUEST}) AS claims,
            (SELECT count(*)::int FROM listing_requests WHERE status = 'pending') AS adds,
            (SELECT count(*)::int FROM admin_inbox WHERE resolved_at IS NULL) AS inbox`,
  );
  return row ?? { claims: 0, adds: 0, inbox: 0 };
}

type CoupleRow = {
  id: string; name: string; email: string; created_at: Date; marketing_opt_in: boolean; google: boolean; has_profile: boolean;
  partner1_name: string | null; partner2_name: string | null; contact_email: string | null; contact_phone: string | null;
  wedding_date: string | null; target_month: number | null; target_year: number | null; location_text: string | null;
  guest_count: number | null; budget_range: string | null; requests: number; saves: number;
};

export async function listCouples(): Promise<TableRow[]> {
  const rows = await query<CoupleRow>(
    `SELECT u.id, u.name, u.email, u.created_at, u.marketing_opt_in,
       EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.provider_id = 'google') AS google,
       w.user_id IS NOT NULL AS has_profile, w.partner1_name, w.partner2_name, w.contact_email, w.contact_phone,
       w.wedding_date::text AS wedding_date, w.target_month, w.target_year, w.location_text, w.guest_count, w.budget_range,
       (SELECT count(*)::int FROM connection_requests c WHERE c.user_id = u.id) AS requests,
       (SELECT count(*)::int FROM saved_listings s WHERE s.user_id = u.id) AS saves
     FROM users u LEFT JOIN wedding_profiles w ON w.user_id = u.id
     WHERE u.account_type = 'couple' AND u.deleted_at IS NULL
     ORDER BY u.created_at DESC LIMIT ${LIMIT}`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: coupleNames(r) || r.name || null,
    email: r.email,
    phone: r.contact_phone,
    signed_up: iso(r.created_at),
    method: r.google ? "Google" : "Email link",
    complete: r.has_profile && missingWeddingFields(r).length === 0 ? "Yes" : "No",
    wedding: weddingWhen(r as Parameters<typeof weddingWhen>[0]),
    wedding_sort: whenSort(r),
    location: r.location_text,
    guests: r.guest_count,
    budget: r.budget_range,
    requests: r.requests,
    saves: r.saves,
    marketing: r.marketing_opt_in ? "Yes" : "No",
  }));
}

const VENDOR_SQL = `
  SELECT u.id, u.email, u.name, u.created_at, cl.claimant_name, cl.claimant_phone,
    (SELECT count(*)::int FROM listing_claims c WHERE c.user_id = u.id AND c.status = 'approved') AS owned,
    (SELECT count(*)::int FROM listing_claims c WHERE c.user_id = u.id AND c.status = 'pending') AS pending,
    (SELECT string_agg(l.name, ', ' ORDER BY l.name) FROM listing_claims c
       JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
       WHERE c.user_id = u.id AND c.status = 'approved') AS listings,
    (SELECT coalesce(sum(t.amount_cents), 0)::int FROM wallet_transactions t WHERE t.user_id = u.id) AS balance,
    (SELECT count(*)::int FROM lead_purchases p WHERE p.user_id = u.id) AS leads,
    (SELECT coalesce(sum(p.price_cents), 0)::int FROM lead_purchases p WHERE p.user_id = u.id) AS spent
  FROM users u
  LEFT JOIN LATERAL (
    SELECT claimant_name, claimant_phone FROM listing_claims c WHERE c.user_id = u.id
    ORDER BY (c.status = 'approved') DESC, c.created_at DESC LIMIT 1
  ) cl ON true
  WHERE u.account_type = 'vendor' AND u.deleted_at IS NULL`;

type VendorRow = {
  id: string; email: string; name: string; created_at: Date; claimant_name: string | null; claimant_phone: string | null;
  owned: number; pending: number; listings: string | null; balance: number; leads: number; spent: number;
};

const vendorRow = (r: VendorRow): TableRow => ({
  id: r.id,
  email: r.email,
  contact: r.claimant_name || r.name || null,
  phone: r.claimant_phone,
  signed_up: iso(r.created_at),
  listings: r.listings,
  owned: r.owned,
  pending: r.pending,
  balance: r.balance,
  leads: r.leads,
  spent: r.spent,
  href: `/admin/vendors/${r.id}`,
});

export async function listVendors(): Promise<TableRow[]> {
  const rows = await query<VendorRow>(`${VENDOR_SQL} ORDER BY u.created_at DESC LIMIT ${LIMIT}`);
  return rows.map(vendorRow);
}

export async function getVendor(id: string) {
  const vendor = await queryOne<VendorRow>(`${VENDOR_SQL} AND u.id = $1`, [id]);
  if (!vendor) return null;
  const [claims, transactions] = await Promise.all([
    query<{ id: string; status: string; created_at: Date; name: string | null; listing_type: string; category: string | null; city: string | null; state: string | null; slug: string | null; listing_status: string | null; claimant_role: string }>(
      `SELECT c.id, c.status, c.created_at, c.claimant_role, l.name, c.listing_type, l.category, l.city, l.state, l.slug, l.status AS listing_status
       FROM listing_claims c LEFT JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
       WHERE c.user_id = $1 ORDER BY c.created_at DESC`,
      [id],
    ),
    query<{ id: string; created_at: Date; kind: string; amount_cents: number; description: string | null }>(
      "SELECT id, created_at, kind, amount_cents, description FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500",
      [id],
    ),
  ]);
  return {
    vendor: vendorRow(vendor),
    claims: claims.map((c) => ({
      id: c.id,
      listing: c.name,
      href: publicHref(c),
      type: typeLabel(c.listing_type, c.category),
      location: place(c.city, c.state),
      status: c.claimant_role === "Added this listing" ? `${c.status} (added listing)` : c.status,
      submitted: iso(c.created_at),
    })) satisfies TableRow[],
    transactions: transactions.map((t) => ({
      id: t.id,
      date: iso(t.created_at),
      kind: { top_up: "Top-up", purchase: "Lead purchase", adjustment: "Adjustment" }[t.kind] ?? t.kind,
      amount: t.amount_cents,
      description: t.description,
    })) satisfies TableRow[],
  };
}

type ClaimRow = {
  id: string; status: string; created_at: Date; reviewed_at: Date | null; claimant_name: string; claimant_role: string;
  claimant_phone: string; note: string | null; account_email: string; user_id: string; name: string | null; listing_type: string;
  category: string | null; city: string | null; state: string | null; slug: string | null; phone_1: string | null;
  connect_to: string | null; domain: string | null; listing_status: string | null;
};

export async function listClaimRequests(status: ReviewStatus): Promise<TableRow[]> {
  const rows = await query<ClaimRow>(
    `SELECT c.id, c.status, c.created_at, c.reviewed_at, c.claimant_name, c.claimant_role, c.claimant_phone, c.note,
       u.email AS account_email, c.user_id, l.name, c.listing_type, l.category, l.city, l.state, l.slug, l.phone_1,
       l.connect_to, l.domain, l.status AS listing_status
     FROM listing_claims c JOIN users u ON u.id = c.user_id
     LEFT JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
     WHERE ($1 = 'all' OR c.status = $1) AND ${NOT_ADD_REQUEST}
     ORDER BY c.created_at DESC LIMIT ${LIMIT}`,
    [status],
  );
  return rows.map((c) => ({
    id: c.id,
    status: c.status,
    submitted: iso(c.created_at),
    listing: c.name ?? `${c.listing_type} (removed)`,
    listing_href: publicHref(c),
    type: typeLabel(c.listing_type, c.category),
    location: place(c.city, c.state),
    claimant: c.claimant_name,
    role: c.claimant_role,
    phone: c.claimant_phone,
    account_email: c.account_email,
    account_href: `/admin/vendors/${c.user_id}`,
    file_phone: c.phone_1,
    file_email: c.connect_to,
    website: c.domain,
    note: c.note,
    reviewed: iso(c.reviewed_at),
  }));
}

type AddRow = {
  id: string; status: string; created_at: Date; reviewed_at: Date | null; account_email: string; user_id: string;
  name: string | null; listing_type: string; category: string | null; address: string | null; city: string | null;
  state: string | null; zip: string | null; phone_1: string | null; connect_to: string | null; domain: string | null;
  description: string | null; slug: string | null; listing_status: string | null;
};

export async function listAddRequests(status: ReviewStatus): Promise<TableRow[]> {
  const rows = await query<AddRow>(
    `SELECT r.id, r.status, r.created_at, r.reviewed_at, u.email AS account_email, r.user_id, l.name, r.listing_type,
       l.category, l.address, l.city, l.state, l.zip, l.phone_1, l.connect_to, l.domain, l.description, l.slug,
       l.status AS listing_status
     FROM listing_requests r JOIN users u ON u.id = r.user_id
     LEFT JOIN listings l ON l.listing_type = r.listing_type AND l.listing_id = r.listing_id
     WHERE ($1 = 'all' OR r.status = $1)
     ORDER BY r.created_at DESC LIMIT ${LIMIT}`,
    [status],
  );
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    submitted: iso(r.created_at),
    listing: r.name ?? "(removed)",
    listing_href: publicHref(r),
    type: typeLabel(r.listing_type, r.category),
    address: r.address,
    location: place(r.city, r.state ? `${r.state} ${r.zip ?? ""}`.trim() : r.zip),
    phone: r.phone_1,
    email: r.connect_to,
    website: r.domain,
    description: r.description,
    account_email: r.account_email,
    account_href: `/admin/vendors/${r.user_id}`,
    reviewed: iso(r.reviewed_at),
  }));
}

const CONNECTION_SQL = `
  SELECT c.id, c.created_at, c.status, c.vendor_email, c.wedding_snapshot AS snapshot, c.message, c.listing_type, c.listing_id,
    u.email AS account_email, l.name AS listing_name, l.category, l.city, l.state, l.slug, l.status AS listing_status,
    p.price_cents, p.created_at AS purchased_at, pu.email AS purchased_by, p.user_id AS purchaser_id
  FROM connection_requests c
  LEFT JOIN users u ON u.id = c.user_id
  LEFT JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
  LEFT JOIN lead_purchases p ON p.request_id = c.id
  LEFT JOIN users pu ON pu.id = p.user_id`;

export type ConnectionRow = {
  id: string; created_at: Date; status: string; vendor_email: string | null; snapshot: LeadSnapshot; message: string | null;
  listing_type: "venue" | "vendor"; listing_id: string; account_email: string | null; listing_name: string | null;
  category: string | null; city: string | null; state: string | null; slug: string | null; listing_status: string | null;
  price_cents: number | null; purchased_at: Date | null; purchased_by: string | null; purchaser_id: string | null;
};

export const connectionStatus = (c: Pick<ConnectionRow, "status" | "purchased_at">) =>
  c.purchased_at ? "Purchased" : (STATUS_LABELS[c.status] ?? c.status);

export async function listConnections(): Promise<TableRow[]> {
  const rows = await query<ConnectionRow>(`${CONNECTION_SQL} ORDER BY c.created_at DESC LIMIT ${LIMIT}`);
  return rows.map((c) => {
    const s = c.snapshot ?? {};
    return {
      id: c.id,
      href: `/admin/connections/${c.id}`,
      requested: iso(c.created_at),
      couple: coupleNames(s) || null,
      couple_email: s.contact_email || c.account_email,
      couple_phone: s.contact_phone ?? null,
      wedding: s.when ?? weddingWhen(s as Parameters<typeof weddingWhen>[0]),
      wedding_sort: whenSort(s),
      guests: s.guest_count ?? null,
      budget: s.budget_range ?? null,
      location: s.location_text ?? null,
      listing: c.listing_name ?? "Deleted listing",
      listing_href: publicHref(c),
      type: typeLabel(c.listing_type, c.category),
      listing_location: place(c.city, c.state),
      status: connectionStatus(c),
      sent_to: c.vendor_email,
      price: c.price_cents,
      purchased_by: c.purchased_by,
    };
  });
}

export async function getConnection(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await queryOne<ConnectionRow>(`${CONNECTION_SQL} WHERE c.id = $1`, [id]);
  if (!row) return null;
  const events = await query<{ id: string; type: string; detail: unknown; created_at: Date }>(
    "SELECT id::text, type, detail, created_at FROM connection_events WHERE request_id = $1 ORDER BY created_at",
    [id],
  );
  return { row, href: publicHref(row), events };
}

export async function listLeadPrices() {
  const [defaults, categories] = await Promise.all([
    query<{ listing_type: string; price_cents: number }>("SELECT listing_type, price_cents FROM lead_prices WHERE category = '*'"),
    query<{ category: string; price_cents: number | null; listings: number }>(
      `SELECT k.category, p.price_cents, (SELECT count(*)::int FROM vendors v WHERE v.status = 'active' AND lower(btrim(v.category)) = k.category) AS listings
       FROM (
         SELECT DISTINCT lower(btrim(category)) AS category FROM vendors WHERE status = 'active' AND nullif(btrim(category), '') IS NOT NULL
         UNION SELECT category FROM lead_prices WHERE listing_type = 'vendor' AND category <> '*'
       ) k
       LEFT JOIN lead_prices p ON p.listing_type = 'vendor' AND p.category = k.category
       ORDER BY k.category`,
    ),
  ]);
  return {
    venue: defaults.find((d) => d.listing_type === "venue")?.price_cents ?? null,
    vendor: defaults.find((d) => d.listing_type === "vendor")?.price_cents ?? null,
    categories: categories.map((c) => ({ ...c, label: categoryLabel(c.category) })),
  };
}
