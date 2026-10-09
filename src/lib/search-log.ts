import "server-only";
import { query } from "@/db";
import { searchListings, type SearchParams, type SearchResponse } from "./search";
import type { Viewer } from "./gating";

/** Anonymous-safe analytics row per first-page search; never blocks the response. */
export async function logSearch(params: SearchParams, response: SearchResponse, userId: string | null, durationMs: number) {
  if (params.page !== 1 || response.error) return;
  try {
    await query(
      `INSERT INTO search_logs (user_id, categories, location_text, radius_miles, filters, has_description, result_count, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, params.categories, params.location.slice(0, 120), params.radius, JSON.stringify(params.filters), Boolean(params.description), response.total, durationMs],
    );
  } catch (error) {
    console.error("[search-log] insert failed", error);
  }
}

export async function timedSearch(params: SearchParams, viewer: Viewer) {
  const started = Date.now();
  const response = await searchListings(params, viewer);
  return { response, durationMs: Date.now() - started };
}
