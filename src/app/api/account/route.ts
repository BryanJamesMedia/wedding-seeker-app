import { NextResponse } from "next/server";
import { z } from "zod";
import { pool, query } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { stripe, isStripeConfigured } from "@/lib/stripe";

const Prefs = z.object({
  email_connect_confirmations: z.boolean(),
  email_saved_search_alerts: z.boolean(),
  marketing_opt_in: z.boolean(),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const parsed = Prefs.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const p = parsed.data;
  await query(
    "UPDATE users SET email_connect_confirmations = $2, email_saved_search_alerts = $3, marketing_opt_in = $4, updated_at = now() WHERE id = $1",
    [user.id, p.email_connect_confirmations, p.email_saved_search_alerts, p.marketing_opt_in],
  );
  return NextResponse.json({ ok: true });
}

/** Deletes the account; connection history is kept anonymized (user_id set null, contact scrubbed). */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.stripe_subscription_id && isStripeConfigured()) {
    await stripe().subscriptions.cancel(user.stripe_subscription_id).catch((e) => console.error("[account] cancel failed", e));
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE connection_requests SET wedding_snapshot = wedding_snapshot - 'contact_email' - 'contact_phone' - 'partner1_name' - 'partner2_name', message = NULL
       WHERE user_id = $1`,
      [user.id],
    );
    await client.query("DELETE FROM search_logs WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM users WHERE id = $1", [user.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const res = NextResponse.json({ ok: true });
  for (const name of ["better-auth.session_token", "__Secure-better-auth.session_token"]) res.cookies.delete(name);
  return res;
}
