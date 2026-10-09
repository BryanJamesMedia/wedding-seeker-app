import "server-only";
import { query } from "@/db";
import {
  CONFIG_KEYS,
  DEFAULT_FIELD_VISIBILITY,
  DEFAULT_FILTERS,
  DEFAULT_LIMITS,
  DEFAULT_MATCH_LABELS,
  DEFAULT_RANKING,
  type AppConfig,
} from "./config-defaults";

const TTL_MS = 30_000;
let cached: { at: number; value: AppConfig } | null = null;

/** Live config: `app_config` rows merged over the typed defaults, cached briefly per instance. */
export async function getConfig(): Promise<AppConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  let rows: { key: string; value: unknown }[] = [];
  try {
    rows = await query<{ key: string; value: unknown }>("SELECT key, value FROM app_config");
  } catch (error) {
    console.error("[config] failed to load app_config, using defaults", error);
  }
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const obj = <T extends object>(key: string, fallback: T): T => {
    const value = byKey.get(key);
    return value && typeof value === "object" && !Array.isArray(value) ? { ...fallback, ...(value as T) } : fallback;
  };
  const filters = byKey.get(CONFIG_KEYS.filters);
  const value: AppConfig = {
    fieldVisibility: obj(CONFIG_KEYS.fieldVisibility, DEFAULT_FIELD_VISIBILITY),
    filters: Array.isArray(filters) ? (filters as AppConfig["filters"]) : DEFAULT_FILTERS,
    ranking: obj(CONFIG_KEYS.ranking, DEFAULT_RANKING),
    matchLabels: obj(CONFIG_KEYS.matchLabels, DEFAULT_MATCH_LABELS),
    limits: obj(CONFIG_KEYS.limits, DEFAULT_LIMITS),
  };
  cached = { at: Date.now(), value };
  return value;
}

export function invalidateConfig() {
  cached = null;
}

export async function setConfig(key: string, value: unknown) {
  await query(
    `INSERT INTO app_config (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
  invalidateConfig();
}
