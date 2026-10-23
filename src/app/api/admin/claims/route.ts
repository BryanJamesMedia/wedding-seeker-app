import { NextResponse, after } from "next/server";
import { z } from "zod";
import { queryOne } from "@/db";
import { getAdmin } from "@/lib/admin";
import { notifyClaimDecision } from "@/lib/review-notice";

const Body = z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]) });

export async function POST(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id, decision } = parsed.data;
  try {
    const row = await queryOne<{ id: string }>(
      `UPDATE listing_claims c SET status = $2, reviewed_at = now()
       WHERE c.id = $1 AND c.status <> $2
         AND NOT EXISTS (SELECT 1 FROM listing_requests r WHERE r.user_id = c.user_id AND r.listing_type = c.listing_type AND r.listing_id = c.listing_id)
       RETURNING c.id`,
      [id, decision],
    );
    if (row) after(() => notifyClaimDecision(id, decision));
    return NextResponse.json({ ok: true, changed: Boolean(row) });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This listing already has an approved owner. Reject or remove that claim first." }, { status: 409 });
    }
    throw err;
  }
}
