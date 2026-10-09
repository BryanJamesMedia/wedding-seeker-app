import "server-only";
import type { AppConfig, FieldTier, ListingField } from "./config-defaults";

export type Viewer = { userId: string | null; paid: boolean };

/** Marker for a value withheld from a non-paid viewer. The real value never leaves the server. */
export const LOCKED = { locked: true } as const;
export type Locked = typeof LOCKED;
export type Gated<T> = T | Locked | null;

export function isLocked(value: unknown): value is Locked {
  return typeof value === "object" && value !== null && (value as Locked).locked === true;
}

function tierFor(config: AppConfig, field: string): FieldTier {
  return config.fieldVisibility[field as ListingField] ?? "hidden";
}

/**
 * Applies the field-visibility config to a raw listing row. Hidden fields are
 * dropped, paid fields become LOCKED for non-paid viewers, and empty values
 * become null so UIs can hide them. Photos keep the first `freeImageCount`
 * free and report how many more are locked.
 */
export function gateListing<T extends Record<string, unknown>>(
  row: T,
  viewer: Viewer,
  config: AppConfig,
  fields: readonly string[],
) {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field === "photos") continue;
    const tier = tierFor(config, field);
    if (tier === "hidden") continue;
    const value = row[field];
    const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
    if (empty) out[field] = null;
    else if (tier === "paid" && !viewer.paid) out[field] = LOCKED;
    else out[field] = value;
  }

  let photos: string[] = [];
  let lockedPhotoCount = 0;
  if (fields.includes("photos") && Array.isArray(row.photos)) {
    const all = (row.photos as string[]).filter(Boolean);
    const tier = tierFor(config, "photos");
    if (tier === "hidden") photos = [];
    else if (tier === "free" || viewer.paid) photos = all;
    else {
      photos = all.slice(0, config.limits.freeImageCount);
      lockedPhotoCount = all.length - photos.length;
    }
  }
  return { ...out, photos, lockedPhotoCount } as Record<string, unknown> & { photos: string[]; lockedPhotoCount: number };
}
