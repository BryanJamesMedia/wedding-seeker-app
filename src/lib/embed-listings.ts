import { query } from "@/db";
import { EMBEDDING_MODEL, embedTexts, hashText, isEmbeddingConfigured, toVectorLiteral } from "./embeddings";

type Pending = {
  table: "venues" | "vendors";
  id: string;
  description: string | null;
  vibe: string | null;
};

/**
 * Finds listings whose embeddings are missing, stale (text changed since the
 * last embed) or produced by a different model, and fills them in batches.
 * Run by the cron route and `npm run embed`.
 */
export async function backfillEmbeddings({ limit = 500, batchSize = 50 } = {}): Promise<{ embedded: number; failed: number }> {
  if (!isEmbeddingConfigured()) {
    console.warn("[embeddings] OPENAI_API_KEY unset, skipping backfill");
    return { embedded: 0, failed: 0 };
  }
  const stale = (table: string) => `
    SELECT '${table}' AS "table", id::text AS id, description, vibe FROM ${table}
    WHERE (coalesce(description, '') <> '' OR coalesce(vibe, '') <> '')
      AND (embedding_model IS DISTINCT FROM $1
        OR embedded_description_hash IS DISTINCT FROM CASE WHEN coalesce(description, '') <> '' THEN encode(sha256(convert_to(lower(regexp_replace(trim(description), '\\s+', ' ', 'g')), 'UTF8')), 'hex') END
        OR embedded_vibe_hash IS DISTINCT FROM CASE WHEN coalesce(vibe, '') <> '' THEN encode(sha256(convert_to(lower(regexp_replace(trim(vibe), '\\s+', ' ', 'g')), 'UTF8')), 'hex') END)`;
  const rows = await query<Pending>(
    `${stale("venues")} UNION ALL ${stale("vendors")} LIMIT $2`,
    [EMBEDDING_MODEL, limit],
  );

  let embedded = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const texts: string[] = [];
    const slots: { row: Pending; field: "description" | "vibe"; index: number }[] = [];
    for (const row of batch) {
      for (const field of ["description", "vibe"] as const) {
        const text = row[field]?.trim();
        if (text) {
          slots.push({ row, field, index: texts.length });
          texts.push(text.slice(0, 8000));
        }
      }
    }
    try {
      const vectors = await embedTexts(texts);
      for (const row of batch) {
        const d = slots.find((s) => s.row === row && s.field === "description");
        const v = slots.find((s) => s.row === row && s.field === "vibe");
        await query(
          `UPDATE ${row.table} SET
             description_embedding = $1::vector, vibe_embedding = $2::vector,
             embedded_description_hash = $3, embedded_vibe_hash = $4,
             embedding_model = $5, embedding_updated_at = now()
           WHERE id::text = $6`,
          [
            d ? toVectorLiteral(vectors[d.index]) : null,
            v ? toVectorLiteral(vectors[v.index]) : null,
            row.description?.trim() ? hashText(row.description) : null,
            row.vibe?.trim() ? hashText(row.vibe) : null,
            EMBEDDING_MODEL,
            row.id,
          ],
        );
        embedded++;
      }
    } catch (error) {
      failed += batch.length;
      console.error("[embeddings] batch failed", error);
    }
  }
  return { embedded, failed };
}
