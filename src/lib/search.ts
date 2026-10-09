import "server-only";
import { query } from "@/db";
import { getConfig } from "./config";
import type { AppConfig, FilterDef, MatchLabelConfig } from "./config-defaults";
import { EMBEDDING_MODEL, getQueryEmbedding } from "./embeddings";
import { gateListing, type Viewer } from "./gating";
import { resolveLocation, type ResolvedLocation } from "./location";

export const RADIUS_OPTIONS = [10, 25, 50, 100] as const;
export const SORT_OPTIONS = ["best", "distance", "rating"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
const METERS_PER_MILE = 1609.344;

export type SearchParams = {
  categories: string[];
  location: string;
  radius: number;
  description: string;
  filters: Record<string, string | string[]>;
  sort: SortOption | null;
  page: number;
};

/** Search state lives in the URL; this parses it defensively. */
export function parseSearchParams(raw: Record<string, string | string[] | undefined>): SearchParams {
  const one = (key: string) => {
    const value = raw[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const many = (key: string) => {
    const value = raw[key];
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return list.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  };
  const radius = Number(one("radius"));
  const sort = one("sort") as SortOption;
  const filters: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith("f_") || value == null) continue;
    filters[key.slice(2)] = Array.isArray(value) ? value : value.includes(",") ? value.split(",") : value;
  }
  return {
    categories: many("category"),
    location: one("location").slice(0, 120),
    radius: (RADIUS_OPTIONS as readonly number[]).includes(radius) ? radius : 25,
    description: one("q").slice(0, 500),
    filters,
    sort: SORT_OPTIONS.includes(sort) ? sort : null,
    page: Math.max(1, Math.min(50, Number(one("page")) || 1)),
  };
}

const FILTER_COLUMNS = new Set([
  "price_min", "price_max", "capacity_min", "capacity_max", "review_score", "review_count",
  "venue_type", "indoor_outdoor", "private_public", "vibe", "description", "summary", "services",
  "amenities", "first_photo", "domain", "category", "region", "parking", "alcohol_policy",
  "catering_policy", "accessibility",
]);

function col(name: string): string {
  if (!FILTER_COLUMNS.has(name)) throw new Error(`Filter column not allowed: ${name}`);
  return `l.${name}`;
}

/** Filters relevant to the chosen categories (all of them when none chosen). */
export function filtersForCategories(filters: FilterDef[], categories: string[]): FilterDef[] {
  const lowered = categories.map((c) => c.toLowerCase());
  return filters.filter(
    (f) => f.categories.length === 0 || lowered.length === 0 || f.categories.some((c) => lowered.some((x) => x.includes(c))),
  );
}

class SqlBuilder {
  params: unknown[] = [];
  where: string[] = [];
  add(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

function applyFilter(sql: SqlBuilder, def: FilterDef, raw: string | string[] | undefined) {
  if (raw == null || raw === "") return;
  const values = (Array.isArray(raw) ? raw : [raw]).map((v) => v.trim()).filter(Boolean);
  if (values.length === 0) return;
  const src = def.source;
  switch (src.kind) {
    case "range": {
      const [min, max] = (values.length === 1 ? values[0].split("-") : values).map((v) => Number(v));
      if (Number.isFinite(min) && min > 0) sql.where.push(`coalesce(${col(src.maxColumn)}, ${col(src.minColumn)}) >= ${sql.add(min)}`);
      if (Number.isFinite(max) && max > 0) sql.where.push(`coalesce(${col(src.minColumn)}, ${col(src.maxColumn)}) <= ${sql.add(max)}`);
      return;
    }
    case "capacity": {
      const n = Number(values[0]);
      if (Number.isFinite(n) && n > 0) sql.where.push(`${col(src.column)} >= ${sql.add(n)}`);
      return;
    }
    case "min": {
      const n = Number(values[0]);
      if (Number.isFinite(n)) sql.where.push(`${col(src.column)} >= ${sql.add(n)}`);
      return;
    }
    case "equals_any":
      sql.where.push(`lower(${col(src.column)}) = ANY(${sql.add(values.map((v) => v.toLowerCase()))})`);
      return;
    case "array_overlaps":
      sql.where.push(`${col(src.column)} && ${sql.add(values)}::text[]`);
      return;
    case "any_of_text": {
      const patterns = sql.add(values.map((v) => `%${v.toLowerCase().replace(/[%_]/g, "")}%`));
      sql.where.push(`(${src.columns.map((c) => `lower(${col(c)}) LIKE ANY(${patterns})`).join(" OR ")})`);
      return;
    }
    case "not_empty":
      if (values[0] === "1" || values[0] === "true") sql.where.push(`coalesce(${col(src.column)}, '') <> ''`);
      return;
  }
}

export function matchLabel(score: number | null, thresholds: MatchLabelConfig): "Top match" | "Great match" | "Good match" | null {
  if (score == null) return null;
  if (score >= thresholds.top) return "Top match";
  if (score >= thresholds.great) return "Great match";
  if (score >= thresholds.good) return "Good match";
  return null;
}

const RESULT_FIELDS = [
  "name", "category", "city", "state", "summary", "review_score", "review_count", "phone_1",
  "domain", "address", "photos",
] as const;

type RawResult = {
  listing_type: "venue" | "vendor";
  listing_id: string;
  slug: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  summary: string | null;
  review_score: string | null;
  review_count: number | null;
  phone_1: string | null;
  domain: string | null;
  address: string | null;
  photos: string[] | null;
  distance_m: number | null;
  match_score: number | null;
  final_score: number | null;
  total: string;
  top_count: string;
};

export type SearchResult = ReturnType<typeof shapeResult>;

function shapeResult(row: RawResult, viewer: Viewer, config: AppConfig) {
  const gated = gateListing({ ...row, photos: row.photos?.slice(0, 1) ?? [] }, viewer, config, RESULT_FIELDS);
  const showRating = viewer.paid || config.limits.showRatingToFree;
  return {
    listingType: row.listing_type,
    listingId: row.listing_id,
    slug: row.slug,
    href: listingHref(row),
    name: row.name,
    category: row.category,
    city: row.city,
    state: row.state,
    summary: (gated.summary as string | null) ?? null,
    rating: showRating && row.review_score != null ? Number(row.review_score) : null,
    reviewCount: showRating ? row.review_count : null,
    phone: gated.phone_1 as string | { locked: true } | null,
    website: gated.domain as string | { locked: true } | null,
    address: gated.address as string | { locked: true } | null,
    thumbnail: gated.photos[0] ?? null,
    distanceMiles: row.distance_m == null ? null : Math.round((row.distance_m / METERS_PER_MILE) * 10) / 10,
    matchLabel: matchLabel(row.match_score, config.matchLabels),
  };
}

export function citySlug(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

export function categorySlug(category: string | null): string {
  return (category ?? "other").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
}

export function listingHref(row: { listing_type: string; category: string | null; city: string | null; state: string | null; slug: string }) {
  const root = row.listing_type === "venue" ? "venues" : "vendors";
  return `/${root}/${categorySlug(row.category)}/${citySlug(row.city, row.state)}/${row.slug}`;
}

export type SearchResponse = {
  params: SearchParams;
  location: ResolvedLocation | null;
  results: SearchResult[];
  total: number;
  topMatches: number;
  shown: number;
  lockedCount: number;
  hasMore: boolean;
  sort: SortOption;
  usedDescription: boolean;
  zeroResultHint: { label: string; href: string } | null;
  error: string | null;
};

/**
 * Hybrid search: SQL filters + radius define the candidate set; the optional
 * description is embedded and scored against both stored vectors; a small
 * capped quality boost breaks near-ties. Every candidate is returned in order.
 */
export async function searchListings(params: SearchParams, viewer: Viewer): Promise<SearchResponse> {
  const config = await getConfig();
  const base: Omit<SearchResponse, "results" | "total" | "topMatches" | "shown" | "lockedCount" | "hasMore"> = {
    params,
    location: null,
    sort: params.sort ?? "best",
    usedDescription: false,
    zeroResultHint: null,
    error: null,
  };
  const empty = { results: [], total: 0, topMatches: 0, shown: 0, lockedCount: 0, hasMore: false };

  const location = params.location ? await resolveLocation(params.location) : null;
  if (params.location && !location) return { ...base, ...empty, error: `We couldn't find "${params.location}". Try a city and state or a ZIP code.` };

  const sql = new SqlBuilder();
  sql.where.push("l.status = 'active'");
  if (params.categories.length > 0) sql.where.push(`l.category = ANY(${sql.add(params.categories)})`);

  let distanceExpr = "NULL::float8";
  if (location) {
    const point = `ST_SetSRID(ST_MakePoint(${sql.add(location.lng)}, ${sql.add(location.lat)}), 4326)::geography`;
    sql.where.push(`ST_DWithin(l.geog, ${point}, ${sql.add(params.radius * METERS_PER_MILE)})`);
    distanceExpr = `ST_Distance(l.geog, ${point})`;
  }
  for (const def of filtersForCategories(config.filters, params.categories)) {
    applyFilter(sql, def, params.filters[def.key]);
  }

  const embedding = params.description ? await getQueryEmbedding(params.description) : null;
  const { ranking } = config;
  let matchExpr = "NULL::float8";
  if (embedding) {
    const vec = `${sql.add(embedding)}::vector`;
    const model = sql.add(EMBEDDING_MODEL);
    // Cosine similarity = 1 - cosine distance. Missing vectors score as 0 for that part.
    matchExpr = `CASE WHEN l.embedding_model = ${model} AND (l.description_embedding IS NOT NULL OR l.vibe_embedding IS NOT NULL) THEN
      ${sql.add(ranking.descriptionWeight)}::float8 * coalesce(1 - (l.description_embedding <=> ${vec}), 0)
      + ${sql.add(ranking.vibeWeight)}::float8 * coalesce(1 - (l.vibe_embedding <=> ${vec}), coalesce(1 - (l.description_embedding <=> ${vec}), 0))
    END`;
  }
  const boostExpr = `LEAST(${sql.add(ranking.boostCap)}::float8, ${sql.add(ranking.boostCap)}::float8 * (
      ${sql.add(ranking.completenessWeight)}::float8 * coalesce(l.completeness_score, 0)::float8
    + ${sql.add(ranking.photoWeight)}::float8 * (CASE WHEN l.first_photo IS NOT NULL THEN 1 ELSE 0 END)
    + ${sql.add(ranking.ratingWeight)}::float8 * coalesce(l.review_score, 0)::float8 / 5
  ))`;

  const sort: SortOption = params.sort ?? "best";
  const orderBy =
    sort === "distance" && location
      ? "distance_m ASC NULLS LAST, final_score DESC NULLS LAST"
      : sort === "rating"
        ? "l.review_score DESC NULLS LAST, l.review_count DESC NULLS LAST, final_score DESC NULLS LAST"
        : embedding
          ? "(match_score IS NULL), final_score DESC NULLS LAST, distance_m ASC NULLS LAST"
          : "l.completeness_score DESC NULLS LAST, l.review_score DESC NULLS LAST, distance_m ASC NULLS LAST";

  const pageSize = config.limits.pageSize;
  const cap = viewer.paid ? Number.POSITIVE_INFINITY : config.limits.freeResultCap;
  const wanted = Math.min(params.page * pageSize, cap);
  const topThreshold = sql.add(config.matchLabels.top);

  const text = `
    WITH scored AS (
      SELECT l.listing_type, l.listing_id, l.slug, l.name, l.category, l.city, l.state, l.summary,
        l.review_score, l.review_count, l.phone_1, l.domain, l.address, l.photos, l.completeness_score,
        ${distanceExpr} AS distance_m,
        ${matchExpr} AS match_score,
        ${matchExpr} + ${boostExpr} AS final_score
      FROM listings l
      WHERE ${sql.where.join(" AND ")}
    )
    SELECT l.*, count(*) OVER () AS total,
      count(*) FILTER (WHERE l.match_score >= ${topThreshold}) OVER () AS top_count
    FROM scored l
    ORDER BY ${orderBy}
    LIMIT ${sql.add(wanted)}`;

  let rows: RawResult[];
  try {
    rows = await query<RawResult>(text, sql.params);
  } catch (error) {
    console.error("[search] query failed", error);
    return { ...base, ...empty, location, error: "Search is temporarily unavailable. Please try again." };
  }

  const total = rows[0] ? Number(rows[0].total) : 0;
  const results = rows.map((r) => shapeResult(r, viewer, config));
  const zeroResultHint = total === 0 ? widenHint(params) : null;
  return {
    ...base,
    location,
    sort,
    usedDescription: Boolean(embedding),
    results,
    total,
    topMatches: rows[0] ? Number(rows[0].top_count) : 0,
    shown: results.length,
    lockedCount: viewer.paid ? 0 : Math.max(0, total - results.length),
    hasMore: results.length < Math.min(total, cap),
    zeroResultHint,
  };
}

function widenHint(params: SearchParams): { label: string; href: string } | null {
  const next = new URLSearchParams(toQueryString(params));
  if (Object.keys(params.filters).length > 0) {
    for (const key of Object.keys(params.filters)) next.delete(`f_${key}`);
    return { label: "Clear detailed filters", href: `/search?${next}` };
  }
  const larger = RADIUS_OPTIONS.find((r) => r > params.radius);
  if (larger) {
    next.set("radius", String(larger));
    return { label: `Expand to ${larger} miles`, href: `/search?${next}` };
  }
  if (params.categories.length > 0) {
    next.delete("category");
    return { label: "Search all categories", href: `/search?${next}` };
  }
  return null;
}

export function toQueryString(params: Partial<SearchParams>): string {
  const qs = new URLSearchParams();
  for (const c of params.categories ?? []) qs.append("category", c);
  if (params.location) qs.set("location", params.location);
  if (params.radius) qs.set("radius", String(params.radius));
  if (params.description) qs.set("q", params.description);
  for (const [key, value] of Object.entries(params.filters ?? {})) {
    qs.set(`f_${key}`, Array.isArray(value) ? value.join(",") : value);
  }
  if (params.sort) qs.set("sort", params.sort);
  return qs.toString();
}

export async function listCategories(): Promise<{ category: string; listingType: "venue" | "vendor"; count: number }[]> {
  const rows = await query<{ category: string; listing_type: "venue" | "vendor"; count: string }>(
    `SELECT category, min(listing_type) AS listing_type, count(*) AS count FROM listings
     WHERE status = 'active' AND category IS NOT NULL GROUP BY category
     ORDER BY min(listing_type) DESC, count(*) DESC`,
  );
  return rows.map((r) => ({ category: r.category, listingType: r.listing_type, count: Number(r.count) }));
}

export async function countListings(): Promise<{ total: number; topState: string | null; topStateCount: number }> {
  const rows = await query<{ state: string | null; count: string }>(
    "SELECT state, count(*) AS count FROM listings WHERE status = 'active' GROUP BY state ORDER BY count(*) DESC",
  );
  const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
  return { total, topState: rows[0]?.state ?? null, topStateCount: rows[0] ? Number(rows[0].count) : 0 };
}
