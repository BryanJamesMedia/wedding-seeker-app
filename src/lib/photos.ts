import type { PoolClient } from "pg";
import { query, withTransaction } from "@/db";

export type ListingType = "venue" | "vendor";
export type PhotoStatus = "active" | "hidden" | "removed";
export type MainPhoto = { src: string; alt: string | null };
type Db = Pick<PoolClient, "query">;

export const PHOTO_PARENT = {
  vendor: { column: "vendor_id", cast: "uuid", table: "vendors" },
  venue: { column: "venue_id", cast: "integer", table: "venues" },
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT = /^[0-9]{1,9}$/;

/**
 * Picks a listing's main photo. Shared by every query so the rule lives in one place:
 * the cover if it is still active, otherwise the active photo with the lowest sort_order.
 * `owner` is the listing row alias (it must expose `id` and `cover_photo_id`).
 */
export function mainPhotoOrder(owner: string): string {
  return `(p.id = ${owner}.cover_photo_id) IS TRUE DESC, p.sort_order, p.created_at, p.id`;
}

export const listingKey = (type: string, id: string) => `${type}:${id}`;

/** Main photo for each listing, keyed by `listingKey`. Listings with no active photo are absent. */
export async function mainPhotos(items: { listingType: ListingType; listingId: string }[]): Promise<Map<string, MainPhoto>> {
  const venueIds = [...new Set(items.filter((i) => i.listingType === "venue" && INT.test(i.listingId)).map((i) => i.listingId))];
  const vendorIds = [...new Set(items.filter((i) => i.listingType === "vendor" && UUID.test(i.listingId)).map((i) => i.listingId))];
  const map = new Map<string, MainPhoto>();
  if (venueIds.length === 0 && vendorIds.length === 0) return map;
  const pick = (type: ListingType) => {
    const { column, table, cast } = PHOTO_PARENT[type];
    return `SELECT '${type}' AS listing_type, o.id::text AS listing_id, p.src, p.alt FROM ${table} o
      CROSS JOIN LATERAL (
        SELECT p.blob_url AS src, p.alt FROM listing_photos p
        WHERE p.${column} = o.id AND p.status = 'active'
        ORDER BY ${mainPhotoOrder("o")} LIMIT 1
      ) p
      WHERE o.id = ANY($${type === "venue" ? 1 : 2}::${cast}[])`;
  };
  const rows = await query<{ listing_type: ListingType; listing_id: string; src: string; alt: string | null }>(
    `${pick("venue")} UNION ALL ${pick("vendor")}`,
    [venueIds, vendorIds],
  );
  for (const r of rows) map.set(listingKey(r.listing_type, r.listing_id), { src: r.src, alt: r.alt });
  return map;
}

/** Makes `photoId` the cover only when the listing has none yet. Never overwrites an existing cover. */
export async function claimCoverIfEmpty(db: Db, type: ListingType, listingId: string, photoId: string): Promise<boolean> {
  const { table, cast } = PHOTO_PARENT[type];
  const result = await db.query(`UPDATE ${table} SET cover_photo_id = $2::uuid WHERE id = $1::${cast} AND cover_photo_id IS NULL`, [listingId, photoId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Re-points cover_photo_id after photos change status. status = 'removed' is a soft delete, so the
 * FK's ON DELETE SET NULL never fires; call this whenever a photo is hidden or removed.
 * Keeps the cover if it is still active, else moves it to the next active photo, else NULL.
 * Returns the cover id afterwards.
 */
export async function repairCover(db: Db, type: ListingType, listingId: string): Promise<string | null> {
  const { column, table, cast } = PHOTO_PARENT[type];
  const result = await db.query<{ cover_photo_id: string | null }>(
    `WITH next AS (
       SELECT (SELECT p.id FROM listing_photos p WHERE p.${column} = o.id AND p.status = 'active'
               ORDER BY ${mainPhotoOrder("o")} LIMIT 1) AS id
       FROM ${table} o WHERE o.id = $1::${cast}
     ), changed AS (
       UPDATE ${table} o SET cover_photo_id = next.id FROM next
       WHERE o.id = $1::${cast} AND o.cover_photo_id IS DISTINCT FROM next.id
       RETURNING o.cover_photo_id
     )
     SELECT cover_photo_id FROM changed
     UNION ALL
     SELECT id FROM next WHERE NOT EXISTS (SELECT 1 FROM changed)`,
    [listingId],
  );
  return result.rows[0]?.cover_photo_id ?? null;
}

/** Owner picks a cover. Only an active photo that belongs to this listing is accepted. */
export async function setCover(type: ListingType, listingId: string, photoId: string): Promise<boolean> {
  const { column, table, cast } = PHOTO_PARENT[type];
  const rows = await query(
    `UPDATE ${table} o SET cover_photo_id = p.id FROM listing_photos p
     WHERE o.id = $1::${cast} AND p.id = $2::uuid AND p.${column} = o.id AND p.status = 'active'
     RETURNING o.id`,
    [listingId, photoId],
  );
  return rows.length > 0;
}

/** Hides, removes (soft delete) or restores a photo, and keeps the listing's cover valid in the same transaction. */
export async function setPhotoStatus(type: ListingType, listingId: string, photoId: string, status: PhotoStatus) {
  const { column, cast } = PHOTO_PARENT[type];
  return withTransaction(async (db) => {
    const updated = await db.query(
      `UPDATE listing_photos SET status = $3 WHERE id = $2::uuid AND ${column} = $1::${cast}`,
      [listingId, photoId, status],
    );
    if (!updated.rowCount) return { updated: false, coverPhotoId: null };
    return { updated: true, coverPhotoId: await repairCover(db, type, listingId) };
  });
}
