import "server-only";
import { del } from "@vercel/blob";
import { query, queryOne, withTransaction } from "@/db";
import type { ListingType } from "@/lib/categories";
import { SIGNUP_NOTIFY_EMAIL, escapeHtml, layout, sendEmail } from "@/lib/email";
import { parseEditable, type EditableValues, type ListingRef } from "@/lib/vendor";

export const LISTING_STATUSES = ["active", "hidden", "pending", "closed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

const TABLE: Record<ListingType, string> = { venue: "venues", vendor: "vendors" };
const PHOTO_COLUMN: Record<ListingType, string> = { venue: "venue_id", vendor: "vendor_id" };
const ID_CAST: Record<ListingType, string> = { venue: "integer", vendor: "uuid" };

export function isListingId(type: ListingType, id: string): boolean {
  return type === "venue" ? /^\d{1,10}$/.test(id) : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export type AdminListingRow = {
  listing_type: ListingType;
  listing_id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  status: string;
  slug: string | null;
  email: string | null;
  owner_email: string | null;
  photos: number;
  claims: number;
  saves: number;
  connections: number;
  purchased: number;
};

const BASE = (type: ListingType) => `
  SELECT '${type}'::text AS listing_type, id::text AS listing_id, name, category, city, state, status, slug,
    coalesce(nullif(connect_email, ''), nullif(email_1, ''), nullif(email_2, ''), nullif(email_3, '')) AS email
  FROM ${TABLE[type]}
  WHERE name ILIKE $1 ESCAPE '\\' OR connect_email ILIKE $1 ESCAPE '\\' OR email_1 ILIKE $1 ESCAPE '\\'
     OR email_2 ILIKE $1 ESCAPE '\\' OR email_3 ILIKE $1 ESCAPE '\\'`;

/** Name or email search across venues and vendors in every status, with what a delete would touch. */
export async function searchAdminListings(q: string): Promise<AdminListingRow[]> {
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return query<AdminListingRow>(
    `SELECT l.*,
       (SELECT u.email FROM listing_claims c JOIN users u ON u.id = c.user_id
          WHERE c.listing_type = l.listing_type AND c.listing_id = l.listing_id AND c.status = 'approved') AS owner_email,
       (SELECT count(*)::int FROM listing_photos p
          WHERE (l.listing_type = 'venue' AND p.venue_id::text = l.listing_id) OR (l.listing_type = 'vendor' AND p.vendor_id::text = l.listing_id)) AS photos,
       (SELECT count(*)::int FROM listing_claims c WHERE c.listing_type = l.listing_type AND c.listing_id = l.listing_id) AS claims,
       (SELECT count(*)::int FROM saved_listings s WHERE s.listing_type = l.listing_type AND s.listing_id = l.listing_id) AS saves,
       (SELECT count(*)::int FROM connection_requests r WHERE r.listing_type = l.listing_type AND r.listing_id = l.listing_id) AS connections,
       (SELECT count(*)::int FROM connection_requests r JOIN lead_purchases p ON p.request_id = r.id
          WHERE r.listing_type = l.listing_type AND r.listing_id = l.listing_id) AS purchased
     FROM (${BASE("venue")} UNION ALL ${BASE("vendor")}) l
     ORDER BY (lower(l.name) = lower($2)) DESC, l.name, l.city LIMIT 50`,
    [pattern, q],
  );
}

export type AdminListing = Record<string, unknown> & { name: string; category: string | null; status: string; email_1: string | null };

export async function getAdminListing(ref: ListingRef): Promise<AdminListing | null> {
  if (!isListingId(ref.listingType, ref.listingId)) return null;
  return queryOne<AdminListing>(`SELECT * FROM ${TABLE[ref.listingType]} WHERE id = $1::${ID_CAST[ref.listingType]}`, [ref.listingId]);
}

export type AdminEdit = { values: EditableValues; name: string; category: string | null; status: ListingStatus };

export function parseAdminEdit(type: ListingType, input: Record<string, unknown>): AdminEdit | { error: string } {
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Name is required." };
  if (name.length > 200) return { error: "Name is too long." };
  const status = String(input.status ?? "");
  if (!(LISTING_STATUSES as readonly string[]).includes(status)) return { error: "Choose a status." };
  const category = type === "vendor" ? String(input.category ?? "").trim().toLowerCase().slice(0, 100) || null : null;
  const parsed = parseEditable(input);
  if ("error" in parsed) return parsed;
  return { values: parsed.values, name, category, status: status as ListingStatus };
}

/** Saves an admin edit. A real name change gets a new slug, and the old URL keeps redirecting. */
export async function updateAdminListing(ref: ListingRef, edit: AdminEdit): Promise<boolean> {
  const table = TABLE[ref.listingType];
  const id = `$1::${ID_CAST[ref.listingType]}`;
  return withTransaction(async (db) => {
    const current = await db.query<{ slug: string | null; renamed: boolean }>(
      `SELECT slug, ws_slugify($2 || coalesce(' ' || nullif($3, ''), ' ' || city, '')) IS DISTINCT FROM regexp_replace(coalesce(slug, ''), '-\\d+$', '') AND name IS DISTINCT FROM $2 AS renamed
       FROM ${table} WHERE id = ${id} FOR UPDATE`,
      [ref.listingId, edit.name, (edit.values.city as string | null | undefined) ?? null],
    );
    const row = current.rows[0];
    if (!row) return false;
    if (row.renamed && row.slug) {
      await db.query(
        `INSERT INTO listing_slug_history (listing_type, old_slug, listing_id) VALUES ($1, $2, $3)
         ON CONFLICT (listing_type, old_slug) DO UPDATE SET listing_id = EXCLUDED.listing_id`,
        [ref.listingType, row.slug, ref.listingId],
      );
    }
    const keys = Object.keys(edit.values) as (keyof EditableValues)[];
    const params: unknown[] = [ref.listingId, edit.name, edit.status];
    const sets = ["name = $2", "status = $3"];
    if (ref.listingType === "vendor") {
      params.push(edit.category);
      sets.push(`category = $${params.length}`);
    }
    for (const k of keys) {
      params.push(edit.values[k]);
      sets.push(`${k} = $${params.length}`);
    }
    if (row.renamed) sets.push("slug = NULL");
    await db.query(`UPDATE ${table} SET ${sets.join(", ")}, updated_at = now() WHERE id = ${id}`, params);
    return true;
  });
}

export type DeletedListing = { name: string; city: string | null; state: string | null; photos: number; claims: number; saves: number; connections: number };

/**
 * Permanently deletes one venue/vendor and what hangs off it (photos, claims, add requests, saves, old slugs).
 * Connection requests and purchased leads stay as history. A full copy goes to `deleted_listings` first.
 */
export async function deleteListing(ref: ListingRef, deletedBy: string): Promise<DeletedListing | null> {
  if (!isListingId(ref.listingType, ref.listingId)) return null;
  const table = TABLE[ref.listingType];
  const photoCol = PHOTO_COLUMN[ref.listingType];
  const id = `$1::${ID_CAST[ref.listingType]}`;
  const result = await withTransaction(async (db) => {
    const found = await db.query<{ listing: Record<string, unknown> }>(
      `SELECT to_jsonb(t) - 'description_embedding' - 'vibe_embedding' - 'geog' AS listing FROM ${table} t WHERE id = ${id} FOR UPDATE`,
      [ref.listingId],
    );
    const listing = found.rows[0]?.listing;
    if (!listing) return null;
    const key = [ref.listingType, ref.listingId];
    const photos = await db.query<{ blob_url: string }>(`SELECT blob_url FROM listing_photos WHERE ${photoCol} = ${id}`, [ref.listingId]);
    const claims = await db.query<{ row: unknown }>(
      "DELETE FROM listing_claims c WHERE listing_type = $1 AND listing_id = $2 RETURNING to_jsonb(c) AS row",
      key,
    );
    const requests = await db.query<{ row: unknown }>(
      "DELETE FROM listing_requests r WHERE listing_type = $1 AND listing_id = $2 RETURNING to_jsonb(r) AS row",
      key,
    );
    const saves = await db.query("DELETE FROM saved_listings WHERE listing_type = $1 AND listing_id = $2", key);
    await db.query("DELETE FROM listing_slug_history WHERE listing_type = $1 AND listing_id = $2", key);
    await db.query("UPDATE admin_inbox SET resolved_at = now() WHERE listing_type = $1 AND listing_id = $2 AND resolved_at IS NULL", key);
    const connections = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM connection_requests WHERE listing_type = $1 AND listing_id = $2",
      key,
    );
    await db.query(`UPDATE ${table} SET cover_photo_id = NULL WHERE id = ${id}`, [ref.listingId]);
    await db.query(`DELETE FROM listing_photos WHERE ${photoCol} = ${id}`, [ref.listingId]);
    await db.query(
      `INSERT INTO deleted_listings (listing_type, listing_id, name, listing, related, deleted_by) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        ref.listingType,
        ref.listingId,
        listing.name ?? null,
        JSON.stringify(listing),
        JSON.stringify({
          claims: claims.rows.map((r) => r.row),
          listing_requests: requests.rows.map((r) => r.row),
          saved_by_couples: saves.rowCount ?? 0,
          photo_urls: photos.rows.map((p) => p.blob_url),
        }),
        deletedBy,
      ],
    );
    await db.query(`DELETE FROM ${table} WHERE id = ${id}`, [ref.listingId]);
    return {
      summary: {
        name: String(listing.name ?? ""),
        city: (listing.city as string | null) ?? null,
        state: (listing.state as string | null) ?? null,
        photos: photos.rows.length,
        claims: claims.rows.length,
        saves: saves.rowCount ?? 0,
        connections: connections.rows[0]?.count ?? 0,
      },
      photoUrls: photos.rows.map((p) => p.blob_url),
    };
  });
  if (!result) return null;
  await deleteBlobs(result.photoUrls);
  return result.summary;
}

async function deleteBlobs(urls: string[]) {
  if (!urls.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  for (let i = 0; i < urls.length; i += 100) {
    await del(urls.slice(i, i + 100)).catch((err) => console.error("[admin] blob delete failed", err));
  }
}

export async function notifyListingDeleted(ref: ListingRef, deleted: DeletedListing, deletedBy: string): Promise<void> {
  const subject = `Listing deleted: ${deleted.name}`;
  const rows: [string, string][] = [
    ["Listing", `${deleted.name} (${ref.listingType === "venue" ? "Venue" : "Vendor"}, ID ${ref.listingId})`],
    ["Location", [deleted.city, deleted.state].filter(Boolean).join(", ") || "Not set"],
    ["Deleted by", deletedBy],
    ["Removed with it", `${deleted.photos} photos, ${deleted.claims} claims, ${deleted.saves} saves`],
    ["Kept as history", `${deleted.connections} connection requests`],
  ];
  await sendEmail({
    to: SIGNUP_NOTIFY_EMAIL,
    subject,
    html: layout(
      `<h1 style="font-size:20px;font-weight:normal">${escapeHtml(subject)}</h1>` +
        rows.map(([k, v]) => `<p style="margin:4px 0"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join("") +
        `<p style="margin-top:16px;color:#555">If you didn't do this, sign in to the admin and check who has access. A full copy of the listing is saved in the <code>deleted_listings</code> table.</p>`,
    ),
  });
}
