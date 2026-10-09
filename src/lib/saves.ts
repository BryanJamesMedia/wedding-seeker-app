import "server-only";
import { query, queryOne } from "@/db";

export type ListingRef = { listingType: "venue" | "vendor"; listingId: string };

export function isListingType(value: unknown): value is "venue" | "vendor" {
  return value === "venue" || value === "vendor";
}

export async function listingExists(ref: ListingRef): Promise<boolean> {
  const row = await queryOne(
    "SELECT 1 FROM listings WHERE listing_type = $1 AND listing_id = $2 AND status = 'active'",
    [ref.listingType, ref.listingId],
  );
  return Boolean(row);
}

export async function saveListing(userId: string, ref: ListingRef) {
  await query(
    `INSERT INTO saved_listings (user_id, listing_type, listing_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [userId, ref.listingType, ref.listingId],
  );
}

export async function unsaveListing(userId: string, ref: ListingRef) {
  await query("DELETE FROM saved_listings WHERE user_id = $1 AND listing_type = $2 AND listing_id = $3", [
    userId,
    ref.listingType,
    ref.listingId,
  ]);
}

export type ListingUserState = {
  saved: boolean;
  connection: { status: string; createdAt: string } | null;
};

/** Per-listing Saved / Requested / Responded state for a paid user's rows. */
export async function getUserStates(userId: string, refs: ListingRef[]): Promise<Map<string, ListingUserState>> {
  const map = new Map<string, ListingUserState>();
  if (refs.length === 0) return map;
  const keys = refs.map((r) => `${r.listingType}:${r.listingId}`);
  const saved = await query<{ k: string }>(
    "SELECT listing_type || ':' || listing_id AS k FROM saved_listings WHERE user_id = $1 AND listing_type || ':' || listing_id = ANY($2)",
    [userId, keys],
  );
  const connections = await query<{ k: string; status: string; created_at: Date }>(
    `SELECT DISTINCT ON (listing_type, listing_id) listing_type || ':' || listing_id AS k, status, created_at
     FROM connection_requests WHERE user_id = $1 AND listing_type || ':' || listing_id = ANY($2)
     ORDER BY listing_type, listing_id, created_at DESC`,
    [userId, keys],
  );
  for (const key of keys) map.set(key, { saved: false, connection: null });
  for (const s of saved) map.get(s.k)!.saved = true;
  for (const c of connections) map.get(c.k)!.connection = { status: c.status, createdAt: c.created_at.toISOString() };
  return map;
}
