import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/db";
import { claimCoverIfEmpty } from "@/lib/photos";

export const runtime = "nodejs";
export const maxDuration = 60;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT = /^[0-9]{1,9}$/;
const MAX_BYTES = 4.5 * 1024 * 1024;

const PARENT = {
  vendor: { column: "vendor_id", cast: "uuid", table: "vendors" },
  venue: { column: "venue_id", cast: "integer", table: "venues" },
} as const;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function authorized(request: Request): boolean {
  const expected = process.env.INGEST_KEY;
  const given = request.headers.get("x-ingest-key");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * n8n photo ingest: one image per request. Stores the file in Vercel Blob and
 * records it in listing_photos. Duplicate images (same sha256 for the same
 * listing, including soft-removed rows) are skipped.
 */
export async function POST(request: Request) {
  if (!authorized(request)) return error("unauthorized", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("bad request: expected multipart/form-data", 400);
  }

  const field = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const text = (key: string) => field(key) || null;
  const int = (key: string) => (/^[0-9]{1,9}$/.test(field(key)) ? Number(field(key)) : null);

  const file = form.get("file");
  const listingId = field("contact_id");
  const kind = field("listing_type").toLowerCase();
  if (kind !== "vendor" && kind !== "venue") return error("bad request: listing_type must be vendor or venue", 400);
  if (!(kind === "vendor" ? UUID : INT).test(listingId)) {
    return error(`bad request: contact_id must be ${kind === "vendor" ? "a uuid" : "an integer"} for a ${kind}`, 400);
  }
  if (!(file instanceof File) || file.size === 0) return error("bad request: file is required", 400);
  const ext = EXT[file.type];
  if (!ext) return error(`unsupported type ${file.type || "unknown"}; use image/jpeg, image/png or image/webp`, 415);
  if (file.size > MAX_BYTES) return error("file too large: limit is 4.5 MB", 413);

  const { column, cast, table } = PARENT[kind];

  try {
    const listing = await queryOne(`SELECT 1 FROM ${table} WHERE id = $1::${cast}`, [listingId]);
    if (!listing) return error(`bad request: ${kind} ${listingId} not found`, 400);

    const buf = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(buf).digest("hex");

    const existing = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM listing_photos WHERE ${column} = $1::${cast} AND content_hash = $2`,
      [listingId, hash],
    );
    if (existing) return NextResponse.json({ result: "exists", photoId: existing.id, status: existing.status });

    const blob = await put(`${kind}s/${listingId}/${randomUUID()}.${ext}`, buf, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });

    try {
      const saved = await withTransaction(async (db) => {
        const { rows } = await db.query<{ id: string }>(
        `INSERT INTO listing_photos
           (${column}, blob_url, blob_path, origin, status, sort_order,
            width, height, bytes, alt, source_url, found_on, content_hash)
         VALUES
           ($1::${cast}, $2, $3, 'scraped', 'active',
            (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM listing_photos WHERE ${column} = $1::${cast}),
            $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          listingId,
          blob.url,
          blob.pathname,
          int("width"),
          int("height"),
          buf.length,
          text("alt"),
          text("source_url"),
          text("found_on"),
          hash,
        ],
        );
        if (!rows.length) return null;
        // First photo for a listing becomes its cover; an existing cover is never replaced.
        const cover = await claimCoverIfEmpty(db, kind, listingId, rows[0].id);
        return { photoId: rows[0].id, cover };
      });
      if (!saved) {
        await del(blob.url);
        return NextResponse.json({ result: "exists" });
      }
      return NextResponse.json({ result: "created", photoId: saved.photoId, blobUrl: blob.url, cover: saved.cover });
    } catch (e) {
      await del(blob.url).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error("photo ingest failed", e);
    return error(e instanceof Error ? e.message : String(e), 500);
  }
}
