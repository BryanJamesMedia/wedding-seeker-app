import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/db";
import { getCurrentUser, isPaid } from "@/lib/session";

const MAX_SAVED_SEARCHES = 25;

const Create = z.object({ name: z.string().trim().min(1).max(80), query: z.string().max(2000), weeklyAlert: z.boolean().default(false) });
const Remove = z.object({ id: z.string().uuid() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  if (!isPaid(user)) return NextResponse.json({ error: "upgrade_required" }, { status: 402 });
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const count = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM saved_searches WHERE user_id = $1", [user.id]);
  if ((count?.n ?? 0) >= MAX_SAVED_SEARCHES) return NextResponse.json({ error: `You can save up to ${MAX_SAVED_SEARCHES} searches.` }, { status: 409 });
  const qs = parsed.data.query.replace(/^\?/, "");
  const row = await queryOne<{ id: string }>(
    "INSERT INTO saved_searches (user_id, name, query, weekly_alert) VALUES ($1, $2, $3, $4) RETURNING id",
    [user.id, parsed.data.name, JSON.stringify({ qs }), parsed.data.weeklyAlert],
  );
  return NextResponse.json({ id: row?.id });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  const parsed = Remove.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await query("DELETE FROM saved_searches WHERE id = $1 AND user_id = $2", [parsed.data.id, user.id]);
  return NextResponse.json({ ok: true });
}
