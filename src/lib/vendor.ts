import "server-only";
import { query, queryOne } from "@/db";
import type { ListingType } from "@/lib/categories";

export type ListingRef = { listingType: ListingType; listingId: string };

export type ClaimStatus = "pending" | "approved" | "rejected";

export type VendorClaim = {
  id: string;
  listing_type: ListingType;
  listing_id: string;
  status: ClaimStatus;
  created_at: Date;
  name: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
};

export async function listClaims(userId: string): Promise<VendorClaim[]> {
  return query<VendorClaim>(
    `SELECT c.id, c.listing_type, c.listing_id, c.status, c.created_at, l.name, l.category, l.city, l.state
     FROM listing_claims c
     LEFT JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
     WHERE c.user_id = $1 ORDER BY (c.status = 'approved') DESC, c.created_at DESC`,
    [userId],
  );
}

/** Whether anyone has an approved claim on the listing (drives "Claim this listing" on public pages). */
export async function isClaimed(ref: ListingRef): Promise<boolean> {
  const row = await queryOne(
    "SELECT 1 FROM listing_claims WHERE listing_type = $1 AND listing_id = $2 AND status = 'approved'",
    [ref.listingType, ref.listingId],
  );
  return Boolean(row);
}

export async function ownsListing(userId: string, ref: ListingRef): Promise<boolean> {
  const row = await queryOne(
    "SELECT 1 FROM listing_claims WHERE user_id = $1 AND listing_type = $2 AND listing_id = $3 AND status = 'approved'",
    [userId, ref.listingType, ref.listingId],
  );
  return Boolean(row);
}

export type ClaimInput = { claimantName: string; claimantRole: string; claimantPhone: string; note: string | null };

export type ClaimResult = { ok: true; status: ClaimStatus } | { ok: false; status: number; error: string };

export async function createClaim(userId: string, ref: ListingRef, input: ClaimInput): Promise<ClaimResult> {
  const listing = await queryOne(
    "SELECT 1 FROM listings WHERE listing_type = $1 AND listing_id = $2 AND status = 'active'",
    [ref.listingType, ref.listingId],
  );
  if (!listing) return { ok: false, status: 404, error: "Listing not found." };
  const owner = await queryOne<{ user_id: string }>(
    "SELECT user_id FROM listing_claims WHERE listing_type = $1 AND listing_id = $2 AND status = 'approved'",
    [ref.listingType, ref.listingId],
  );
  if (owner && owner.user_id !== userId) {
    return { ok: false, status: 409, error: "This listing has already been claimed. Contact support if this is your business." };
  }
  // Re-submitting after a rejection puts the claim back in the review queue.
  const row = await queryOne<{ status: ClaimStatus }>(
    `INSERT INTO listing_claims (user_id, listing_type, listing_id, claimant_name, claimant_role, claimant_phone, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, listing_type, listing_id) DO UPDATE SET
       claimant_name = EXCLUDED.claimant_name, claimant_role = EXCLUDED.claimant_role,
       claimant_phone = EXCLUDED.claimant_phone, note = EXCLUDED.note,
       status = CASE WHEN listing_claims.status = 'rejected' THEN 'pending' ELSE listing_claims.status END,
       reviewed_at = CASE WHEN listing_claims.status = 'rejected' THEN NULL ELSE listing_claims.reviewed_at END
     RETURNING status`,
    [userId, ref.listingType, ref.listingId, input.claimantName, input.claimantRole, input.claimantPhone, input.note],
  );
  return { ok: true, status: row!.status };
}

type FieldKind = "text" | "textarea" | "list" | "number" | "email" | "url";

/** Listing columns an approved owner may edit (same columns on venues and vendors). */
export const EDITABLE_FIELDS = [
  { key: "summary", label: "Short summary", kind: "textarea", group: "About" },
  { key: "description", label: "Description", kind: "textarea", group: "About" },
  { key: "vibe", label: "Vibe and style", kind: "textarea", group: "About" },
  { key: "services", label: "Services (one per line)", kind: "list", group: "About" },
  { key: "amenities", label: "Amenities (one per line)", kind: "list", group: "About" },
  { key: "price_min", label: "Starting price ($)", kind: "number", group: "Pricing and capacity" },
  { key: "price_max", label: "Top price ($)", kind: "number", group: "Pricing and capacity" },
  { key: "price_notes", label: "Pricing notes", kind: "textarea", group: "Pricing and capacity" },
  { key: "capacity_min", label: "Minimum guests", kind: "number", group: "Pricing and capacity" },
  { key: "capacity_max", label: "Maximum guests", kind: "number", group: "Pricing and capacity" },
  { key: "capacity_notes", label: "Capacity notes", kind: "textarea", group: "Pricing and capacity" },
  { key: "connect_email", label: "Email for connection requests", kind: "email", group: "Contact" },
  { key: "phone_1", label: "Phone", kind: "text", group: "Contact" },
  { key: "domain", label: "Website", kind: "url", group: "Contact" },
  { key: "instagram", label: "Instagram", kind: "url", group: "Contact" },
  { key: "facebook", label: "Facebook", kind: "url", group: "Contact" },
  { key: "address", label: "Street address", kind: "text", group: "Location" },
  { key: "city", label: "City", kind: "text", group: "Location" },
  { key: "state", label: "State", kind: "text", group: "Location" },
  { key: "zip", label: "ZIP code", kind: "text", group: "Location" },
] as const satisfies readonly { key: string; label: string; kind: FieldKind; group: string }[];

export type EditableKey = (typeof EDITABLE_FIELDS)[number]["key"];
export type EditableValues = Partial<Record<EditableKey, string | number | string[] | null>>;

const TABLE: Record<ListingType, string> = { venue: "venues", vendor: "vendors" };
const COLUMNS = EDITABLE_FIELDS.map((f) => f.key).join(", ");

export async function getEditableListing(ref: ListingRef): Promise<(EditableValues & { name: string; email_1: string | null }) | null> {
  return queryOne(
    `SELECT name, email_1, ${COLUMNS} FROM ${TABLE[ref.listingType]} WHERE id::text = $1`,
    [ref.listingId],
  );
}

/** Normalizes raw form input: trims text, splits lists, parses numbers, blanks become NULL. */
export function parseEditable(input: Record<string, unknown>): { values: EditableValues } | { error: string } {
  const values: EditableValues = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field.key in input)) continue;
    const raw = input[field.key];
    if (field.kind === "list") {
      const items = (Array.isArray(raw) ? raw : String(raw ?? "").split("\n"))
        .map((v) => String(v).trim())
        .filter(Boolean)
        .slice(0, 50);
      values[field.key] = items.length ? items : null;
      continue;
    }
    const text = String(raw ?? "").trim();
    if (!text) {
      values[field.key] = null;
      continue;
    }
    if (text.length > (field.kind === "textarea" ? 5000 : 300)) return { error: `${field.label} is too long.` };
    if (field.kind === "number") {
      const n = Number(text.replace(/[$,]/g, ""));
      if (!Number.isFinite(n) || n < 0) return { error: `${field.label} must be a number.` };
      values[field.key] = field.key.startsWith("capacity") ? Math.round(n) : n;
    } else if (field.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      return { error: `${field.label} must be a valid email.` };
    } else values[field.key] = text;
  }
  return { values };
}

export async function updateListing(ref: ListingRef, values: EditableValues): Promise<void> {
  const keys = Object.keys(values) as EditableKey[];
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  await query(`UPDATE ${TABLE[ref.listingType]} SET ${sets}, updated_at = now() WHERE id::text = $1`, [
    ref.listingId,
    ...keys.map((k) => values[k]),
  ]);
}
