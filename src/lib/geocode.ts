import { readFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@/db";

/**
 * Fills latitude/longitude for listings that have none, so `geog` (and radius
 * search) works for them. Street addresses go to the free US Census batch
 * geocoder; anything it can't match falls back to the ZIP center, then the
 * city center. Rows whose coordinates came from the source data
 * (`geocode_source IS NULL`) are never touched.
 */

const CENSUS_BATCH_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";
const ID_CAST = { venues: "integer", vendors: "uuid" } as const;
type Table = keyof typeof ID_CAST;

type Pending = {
  table: Table;
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  input: string;
};

type Point = { lat: number; lng: number };
type Source = "census" | "zip" | "city" | "none";
type Update = { row: Pending; lat: number | null; lng: number | null; source: Source };

export type GeocodeResult = {
  processed: number;
  census: number;
  zip: number;
  city: number;
  none: number;
  failed: number;
  zipCentroidsLoaded: number;
};

/** Loads the bundled Census ZIP centers (data/zip-centroids.csv) on first run. */
export async function ensureZipCentroids(): Promise<number> {
  const [row] = await query<{ n: string }>("SELECT count(*) AS n FROM zip_centroids");
  if (Number(row?.n) > 0) return 0;
  const csv = await readFile(path.join(process.cwd(), "data", "zip-centroids.csv"), "utf8");
  const zips: string[] = [];
  const lats: string[] = [];
  const lngs: string[] = [];
  for (const line of csv.split("\n")) {
    const [zip, lat, lng] = line.trim().split(",");
    if (/^\d{5}$/.test(zip ?? "") && lat && lng) {
      zips.push(zip);
      lats.push(lat);
      lngs.push(lng);
    }
  }
  await query(
    `INSERT INTO zip_centroids (zip, lat, lng)
     SELECT * FROM unnest($1::text[], $2::numeric[], $3::numeric[]) ON CONFLICT DO NOTHING`,
    [zips, lats, lngs],
  );
  return zips.length;
}

const csvField = (value: string | null) => `"${(value ?? "").replace(/[\r\n]+/g, " ").replace(/"/g, '""')}"`;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      fields.push(current);
      current = "";
    } else current += ch;
  }
  fields.push(current);
  return fields;
}

/** One Census batch request (max 10,000 rows). Returns matches keyed by row index. */
export async function censusBatch(rows: Pick<Pending, "address" | "city" | "state" | "zip">[]): Promise<Map<number, Point>> {
  const csv = rows.map((r, i) => [String(i), r.address, r.city, r.state, r.zip].map(csvField).join(",")).join("\n");
  const form = new FormData();
  form.append("addressFile", new Blob([csv], { type: "text/csv" }), "addresses.csv");
  form.append("benchmark", "Public_AR_Current");
  const response = await fetch(CENSUS_BATCH_URL, { method: "POST", body: form, signal: AbortSignal.timeout(240_000) });
  if (!response.ok) throw new Error(`Census geocoder returned ${response.status}`);
  const matches = new Map<number, Point>();
  for (const line of (await response.text()).split("\n")) {
    if (!line.trim()) continue;
    const [id, , status, , , coords] = parseCsvLine(line);
    if (status !== "Match" || !coords) continue;
    const [lng, lat] = coords.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) matches.set(Number(id), { lat, lng });
  }
  return matches;
}

/** ZIP center, else the average point of other listings in the same city. */
async function fallbackPoints(rows: Pending[]): Promise<Update[]> {
  if (rows.length === 0) return [];
  const found = await query<{ i: number; lat: string | null; lng: string | null; source: Source }>(
    `SELECT m.i, coalesce(z.lat, c.lat) AS lat, coalesce(z.lng, c.lng) AS lng,
       CASE WHEN z.zip IS NOT NULL THEN 'zip' WHEN c.lat IS NOT NULL THEN 'city' ELSE 'none' END AS source
     FROM unnest($1::int[], $2::text[], $3::text[], $4::text[]) AS m(i, zip, city, state)
     LEFT JOIN zip_centroids z ON z.zip = m.zip
     LEFT JOIN LATERAL (
       SELECT avg(ST_Y(l.geog::geometry))::numeric AS lat, avg(ST_X(l.geog::geometry))::numeric AS lng FROM listings l
       WHERE m.city IS NOT NULL AND l.geog IS NOT NULL AND lower(btrim(l.city)) = lower(m.city)
         AND (m.state IS NULL OR lower(btrim(l.state)) = lower(m.state))
     ) c ON z.zip IS NULL`,
    [rows.map((_, i) => i), rows.map((r) => r.zip), rows.map((r) => r.city), rows.map((r) => r.state)],
  );
  return found.map((f) => ({
    row: rows[f.i],
    lat: f.lat == null ? null : Number(f.lat),
    lng: f.lng == null ? null : Number(f.lng),
    source: f.source,
  }));
}

async function save(updates: Update[]) {
  for (const table of Object.keys(ID_CAST) as Table[]) {
    const mine = updates.filter((u) => u.row.table === table);
    if (mine.length === 0) continue;
    await query(
      `UPDATE ${table} t SET latitude = u.lat, longitude = u.lng, geocode_source = u.source,
         geocode_input = u.input, geocoded_at = now()
       FROM unnest($1::text[], $2::numeric[], $3::numeric[], $4::text[], $5::text[]) AS u(id, lat, lng, source, input)
       WHERE t.id = u.id::${ID_CAST[table]}`,
      [
        mine.map((u) => u.row.id),
        mine.map((u) => u.lat),
        mine.map((u) => u.lng),
        mine.map((u) => u.source),
        mine.map((u) => u.row.input),
      ],
    );
  }
}

export async function backfillGeocodes({ limit = 2000, batchSize = 1000 } = {}): Promise<GeocodeResult> {
  const result: GeocodeResult = { processed: 0, census: 0, zip: 0, city: 0, none: 0, failed: 0, zipCentroidsLoaded: 0 };
  result.zipCentroidsLoaded = await ensureZipCentroids();

  const pending = (table: Table) => `
    SELECT '${table}' AS "table", id::text AS id, nullif(btrim(address), '') AS address,
      nullif(btrim(city), '') AS city, nullif(btrim(state), '') AS state, nullif(left(btrim(zip), 5), '') AS zip,
      ws_geocode_input(address, city, state, zip) AS input
    FROM ${table}
    WHERE (latitude IS NULL OR longitude IS NULL OR geocode_source IS NOT NULL)
      AND geocode_input IS DISTINCT FROM ws_geocode_input(address, city, state, zip)`;
  const rows = await query<Pending>(`${pending("venues")} UNION ALL ${pending("vendors")} LIMIT $1`, [limit]);

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const withStreet = batch.filter((r) => r.address);
    let matches: Map<number, Point>;
    try {
      matches = withStreet.length ? await censusBatch(withStreet) : new Map();
    } catch (error) {
      // Leave the batch for the next run rather than settling for ZIP centers.
      console.error("[geocode] census batch failed", error);
      result.failed += batch.length;
      continue;
    }
    const updates: Update[] = [];
    withStreet.forEach((row, i) => {
      const point = matches.get(i);
      if (point) updates.push({ row, ...point, source: "census" });
    });
    const matched = new Set(updates.map((u) => u.row));
    updates.push(...(await fallbackPoints(batch.filter((r) => !matched.has(r)))));
    await save(updates);
    for (const u of updates) result[u.source]++;
    result.processed += updates.length;
  }
  return result;
}
