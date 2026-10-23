import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/db";
import { getAdmin } from "@/lib/admin";
import { getBalance } from "@/lib/leads";

const Body = z.object({
  userId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  amountCents: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 100_000, "Enter an amount between -$1,000 and $1,000"),
  note: z.string().trim().min(1, "Add a note").max(200),
});

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { userId, amountCents, note } = parsed.data;
  const vendor = await queryOne("SELECT 1 FROM users WHERE id = $1 AND account_type = 'vendor'", [userId]);
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  await query(
    "INSERT INTO wallet_transactions (user_id, amount_cents, kind, description) VALUES ($1, $2, 'adjustment', $3)",
    [userId, amountCents, note],
  );
  return NextResponse.json({ ok: true, balanceCents: await getBalance(userId) });
}
