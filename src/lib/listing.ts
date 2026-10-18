import "server-only";
import { query, queryOne } from "@/db";
import { getConfig } from "./config";
import { LISTING_FIELDS } from "./config-defaults";
import { gateListing, isLocked, type Viewer } from "./gating";
import { citySlug, listingHref, categorySlug } from "./search";
import { listingKey, mainPhotoOrder, mainPhotos, PHOTO_PARENT } from "./photos";

type Row = Record<string, unknown> & {
  listing_type: "venue" | "vendor";
  listing_id: string;
  slug: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

const DETAIL_FIELDS = LISTING_FIELDS.filter((f) => !["latitude", "longitude"].includes(f));

export type GalleryPhoto = { src: string; alt: string | null };

/** Active photos from listing_photos (n8n scrape / owner uploads): main photo first (see mainPhotoOrder), then sort_order. */
export async function listingPhotos(type: "venue" | "vendor", id: string): Promise<GalleryPhoto[]> {
  const { column, cast, table } = PHOTO_PARENT[type];
  return query<GalleryPhoto>(
    `SELECT p.blob_url AS src, p.alt FROM ${table} o JOIN listing_photos p ON p.${column} = o.id
     WHERE o.id = $1::${cast} AND p.status = 'active'
     ORDER BY ${mainPhotoOrder("o")}`,
    [id],
  );
}

/** Resolves a slug (or an old slug from history) for a listing type. */
export async function findListingBySlug(type: "venue" | "vendor", slug: string) {
  const row = await queryOne<Row>(
    `SELECT l.*, ST_Y(l.geog::geometry) AS lat, ST_X(l.geog::geometry) AS lng FROM listings l
     WHERE l.listing_type = $1 AND l.slug = $2 AND l.status = 'active'`,
    [type, slug],
  );
  if (row) return { row, redirectTo: null as string | null };
  const moved = await queryOne<Row>(
    `SELECT l.* FROM listing_slug_history h JOIN listings l ON l.listing_type = h.listing_type AND l.listing_id = h.listing_id
     WHERE h.listing_type = $1 AND h.old_slug = $2 AND l.status = 'active'`,
    [type, slug],
  );
  return { row: null, redirectTo: moved ? listingHref(moved) : null };
}

export async function getListingDetail(type: "venue" | "vendor", slug: string, viewer: Viewer) {
  const { row, redirectTo } = await findListingBySlug(type, slug);
  if (!row) return { listing: null, redirectTo };
  const [config, scraped] = await Promise.all([getConfig(), listingPhotos(type, row.listing_id)]);
  const gated = gateListing(row, viewer, config, DETAIL_FIELDS);
  // listing_photos are shown to everyone; listings without them fall back to the gated legacy photos column.
  const gallery: GalleryPhoto[] = scraped.length ? scraped : gated.photos.map((src) => ({ src, alt: null }));
  return {
    redirectTo: null,
    listing: Object.assign({} as Record<string, unknown>, gated, {
      listingType: row.listing_type,
      listingId: row.listing_id,
      slug: row.slug,
      name: row.name,
      href: listingHref(row),
      categorySlug: categorySlug(row.category),
      citySlug: citySlug(row.city, row.state),
      gallery,
      photos: gallery.map((p) => p.src),
      lockedPhotoCount: scraped.length ? 0 : gated.lockedPhotoCount,
      // City-level point for the free map; exact pin only when the address is visible.
      mapPoint:
        row.lat == null
          ? null
          : isLocked(gated.address) || gated.address == null
            ? { lat: Math.round(Number(row.lat) * 50) / 50, lng: Math.round(Number(row.lng) * 50) / 50, exact: false }
            : { lat: Number(row.lat), lng: Number(row.lng), exact: true },
      showRating: viewer.paid || config.limits.showRatingToFree,
    }),
  };
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingDetail>>["listing"]>;

/** Six listings in the same category and area, ranked by vibe similarity to this one. */
export async function similarListings(type: "venue" | "vendor", id: string) {
  const rows = await query<Row & { first_photo: string | null; summary: string | null }>(
    `WITH me AS (SELECT * FROM listings WHERE listing_type = $1 AND listing_id = $2)
     SELECT l.listing_type, l.listing_id, l.slug, l.name, l.category, l.city, l.state, l.first_photo, l.summary
     FROM listings l, me
     WHERE l.status = 'active' AND l.category = me.category AND NOT (l.listing_type = me.listing_type AND l.listing_id = me.listing_id)
       AND (me.geog IS NULL OR ST_DWithin(l.geog, me.geog, 80467))
     ORDER BY CASE WHEN me.vibe_embedding IS NOT NULL AND l.vibe_embedding IS NOT NULL AND l.embedding_model = me.embedding_model
       THEN l.vibe_embedding <=> me.vibe_embedding END ASC NULLS LAST, l.completeness_score DESC NULLS LAST
     LIMIT 6`,
    [type, id],
  );
  const covers = await mainPhotos(rows.map((r) => ({ listingType: r.listing_type, listingId: r.listing_id })));
  return rows.map((r) => ({ ...r, first_photo: covers.get(listingKey(r.listing_type, r.listing_id))?.src ?? r.first_photo, href: listingHref(r) }));
}
