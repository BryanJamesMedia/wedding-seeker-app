import { createHash } from "node:crypto";
import OpenAI from "openai";
import { query, queryOne } from "@/db";

/**
 * The query vector must come from the same model that produced the stored
 * listing vectors. Model + dimensions are recorded per listing in
 * `embedding_model`; see docs/embeddings.md.
 */
export const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 1536);

/**
 * Without an OpenAI key (local dev only) a deterministic hashed bag-of-words
 * embedding stands in. Its vectors are tagged with their own model name and are
 * never compared against real model vectors.
 */
const DEV_HASH_MODEL = `dev-hash-${EMBEDDING_DIMENSIONS}`;
const useDevHash = !process.env.OPENAI_API_KEY && process.env.NODE_ENV !== "production";

export const EMBEDDING_MODEL = useDevHash
  ? DEV_HASH_MODEL
  : (process.env.EMBEDDING_MODEL ?? "text-embedding-3-small");

let client: OpenAI | null = null;

export function isEmbeddingConfigured(): boolean {
  return useDevHash || Boolean(process.env.OPENAI_API_KEY);
}

function devHashEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const words = normalizeText(text).match(/[a-z0-9]+/g) ?? [];
  for (const word of words) {
    if (word.length < 3) continue;
    const digest = createHash("md5").update(word).digest();
    const index = digest.readUInt32BE(0) % EMBEDDING_DIMENSIONS;
    vector[index] += digest[4] & 1 ? 1 : -1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((v) => v / norm);
}

function openai(): OpenAI {
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function hashText(text: string): string {
  return createHash("sha256").update(normalizeText(text)).digest("hex");
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (useDevHash) return texts.map(devHashEmbedding);
  const response = await openai().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Returns the query embedding as a pgvector literal, cached by normalized-text hash. */
export async function getQueryEmbedding(text: string): Promise<string | null> {
  const normalized = normalizeText(text);
  if (!normalized || !isEmbeddingConfigured()) return null;
  const textHash = hashText(normalized);
  const cachedRow = await queryOne<{ embedding: string }>(
    "SELECT embedding::text AS embedding FROM query_embeddings WHERE text_hash = $1 AND model = $2",
    [textHash, EMBEDDING_MODEL],
  );
  if (cachedRow) return cachedRow.embedding;
  try {
    const [vector] = await embedTexts([normalized]);
    const literal = toVectorLiteral(vector);
    await query(
      `INSERT INTO query_embeddings (text_hash, model, embedding) VALUES ($1, $2, $3::vector)
       ON CONFLICT DO NOTHING`,
      [textHash, EMBEDDING_MODEL, literal],
    );
    return literal;
  } catch (error) {
    console.error("[embeddings] query embedding failed", error);
    return null;
  }
}
