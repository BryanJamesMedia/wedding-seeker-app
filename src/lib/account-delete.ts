import "server-only";
import { withTransaction } from "@/db";

/**
 * Deletes a user and everything that cascades from it (sessions, saves, claims, wallet, purchases).
 * Connection history is kept anonymized: user_id becomes NULL and contact details are scrubbed.
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  return withTransaction(async (db) => {
    await db.query(
      `UPDATE connection_requests SET wedding_snapshot = wedding_snapshot - 'contact_email' - 'contact_phone' - 'partner1_name' - 'partner2_name', message = NULL
       WHERE user_id = $1`,
      [userId],
    );
    await db.query("DELETE FROM search_logs WHERE user_id = $1", [userId]);
    const res = await db.query("DELETE FROM users WHERE id = $1", [userId]);
    return (res.rowCount ?? 0) > 0;
  });
}
