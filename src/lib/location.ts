import "server-only";
import { query, queryOne } from "@/db";

export type ResolvedLocation = { label: string; lat: number; lng: number };

/**
 * Locations resolve against the listing data itself (city / ZIP centroids), so
 * search works nationally with no third-party geocoder. "lat,lng" strings come
 * from the browser's "use my location" button.
 */
export async function resolveLocation(input: string): Promise<ResolvedLocation | null> {
  const text = input.trim();
  if (!text) return null;

  const coords = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coords) {
    const lat = Number(coords[1]);
    const lng = Number(coords[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { label: "Your location", lat, lng };
  }

  const key = text.toLowerCase();
  const cachedRow = await queryOne<{ label: string; lat: string; lng: string }>(
    "SELECT label, lat, lng FROM geocode_cache WHERE query = $1",
    [key],
  );
  if (cachedRow) return { label: cachedRow.label, lat: Number(cachedRow.lat), lng: Number(cachedRow.lng) };

  let row: { label: string; lat: number; lng: number } | null = null;
  const zip = text.match(/^\d{5}$/);
  if (zip) {
    row = await queryOne(
      `SELECT zip AS label, avg(ST_Y(geog::geometry)) AS lat, avg(ST_X(geog::geometry)) AS lng
       FROM listings WHERE zip = $1 AND geog IS NOT NULL GROUP BY zip`,
      [text],
    );
  } else {
    const [cityPart, statePart] = text.split(",").map((s) => s.trim());
    row = await queryOne(
      `SELECT city || ', ' || state AS label, avg(ST_Y(geog::geometry)) AS lat, avg(ST_X(geog::geometry)) AS lng
       FROM listings
       WHERE lower(city) = lower($1) AND ($2::text IS NULL OR lower(state) = lower($2)) AND geog IS NOT NULL
       GROUP BY city, state ORDER BY count(*) DESC LIMIT 1`,
      [cityPart, statePart || null],
    );
  }
  if (!row || row.lat == null) return null;
  const result = { label: row.label, lat: Number(row.lat), lng: Number(row.lng) };
  await query(
    "INSERT INTO geocode_cache (query, label, lat, lng) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
    [key, result.label, result.lat, result.lng],
  );
  return result;
}

/** Autocomplete for the location input: cities and ZIPs that have listings. */
export async function suggestLocations(prefix: string): Promise<string[]> {
  const text = prefix.trim();
  if (text.length < 2) return [];
  if (/^\d+$/.test(text)) {
    const rows = await query<{ zip: string }>(
      "SELECT DISTINCT zip FROM listings WHERE status = 'active' AND zip LIKE $1 ORDER BY zip LIMIT 8",
      [`${text}%`],
    );
    return rows.map((r) => r.zip);
  }
  const rows = await query<{ label: string }>(
    `SELECT city || ', ' || state AS label FROM listings
     WHERE status = 'active' AND city ILIKE $1 AND state IS NOT NULL
     GROUP BY city, state ORDER BY count(*) DESC LIMIT 8`,
    [`${text}%`],
  );
  return rows.map((r) => r.label);
}
