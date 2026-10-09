import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  return new Pool({
    connectionString: url,
    ssl: !url || url.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 5,
  });
}

export const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
