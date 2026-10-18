import "server-only";
import { query } from "@/db";

/**
 * A searched place. `lat`/`lng` drive the radius search; `zips`/`cities` also
 * match listings by their address text, so a listing with no map point still
 * shows up when its ZIP or city is searched.
 */
export type ResolvedLocation = {
  label: string;
  lat: number | null;
  lng: number | null;
  zips: string[];
  cities: { city: string; state: string | null }[];
};

const ZIP5 = "left(btrim(zip), 5)";

type PlaceRow = { label: string; lat: number | null; lng: number | null };

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
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { label: "Your location", lat, lng, zips: [], cities: [] };
  }

  const zip = text.match(/^(\d{5})(?:-\d{4})?$/);
  if (zip) {
    const zip5 = zip[1];
    // Census ZIP center first; listings' average point if the ZIP isn't in that list.
    const [center] = await query<PlaceRow>(
      `SELECT $1::text AS label,
         coalesce(z.lat, avg(ST_Y(l.geog::geometry))) AS lat, coalesce(z.lng, avg(ST_X(l.geog::geometry))) AS lng
       FROM (SELECT 1) one
       LEFT JOIN zip_centroids z ON z.zip = $1
       LEFT JOIN listings l ON left(btrim(l.zip), 5) = $1
       GROUP BY z.lat, z.lng HAVING z.lat IS NOT NULL OR count(l.listing_id) > 0`,
      [zip5],
    );
    if (!center) return null;
    const cities = await query<{ city: string; state: string | null }>(
      `SELECT DISTINCT btrim(city) AS city, nullif(btrim(state), '') AS state FROM listings
       WHERE ${ZIP5} = $1 AND nullif(btrim(city), '') IS NOT NULL`,
      [zip5],
    );
    return toLocation(center, [zip5], cities);
  }

  const [cityPart, statePart] = text.split(",").map((s) => s.trim());
  const state = statePart || null;
  const [center] = await query<PlaceRow>(
    `SELECT min(btrim(city)) || coalesce(', ' || min(btrim(state)), '') AS label,
       avg(ST_Y(geog::geometry)) AS lat, avg(ST_X(geog::geometry)) AS lng
     FROM listings
     WHERE lower(btrim(city)) = lower($1) AND ($2::text IS NULL OR lower(btrim(state)) = lower($2))
     GROUP BY lower(btrim(city)), lower(btrim(state)) ORDER BY count(*) DESC LIMIT 1`,
    [cityPart, state],
  );
  if (!center) return null;
  return toLocation(center, [], [{ city: cityPart, state }]);
}

function toLocation(row: PlaceRow, zips: string[], cities: ResolvedLocation["cities"]): ResolvedLocation {
  const hasPoint = row.lat != null && row.lng != null;
  return {
    label: row.label,
    lat: hasPoint ? Number(row.lat) : null,
    lng: hasPoint ? Number(row.lng) : null,
    zips,
    cities,
  };
}

/** Autocomplete for the location input: cities and ZIPs that have listings. */
export async function suggestLocations(prefix: string): Promise<string[]> {
  const text = prefix.trim();
  if (text.length < 2) return [];
  if (/^\d+$/.test(text)) {
    const rows = await query<{ zip: string }>(
      `SELECT DISTINCT ${ZIP5} AS zip FROM listings WHERE status = 'active' AND ${ZIP5} LIKE $1 ORDER BY 1 LIMIT 8`,
      [`${text}%`],
    );
    return rows.map((r) => r.zip);
  }
  const rows = await query<{ label: string }>(
    `SELECT min(btrim(city)) || ', ' || min(btrim(state)) AS label FROM listings
     WHERE status = 'active' AND btrim(city) ILIKE $1 AND nullif(btrim(state), '') IS NOT NULL
     GROUP BY lower(btrim(city)), lower(btrim(state)) ORDER BY count(*) DESC LIMIT 8`,
    [`${text}%`],
  );
  return rows.map((r) => r.label);
}
