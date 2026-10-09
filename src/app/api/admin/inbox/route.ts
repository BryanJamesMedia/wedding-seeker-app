import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/db";
import { getAdmin } from "@/lib/admin";

const Body = z.object({ id: z.string().uuid() });

export async function POST(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await query("UPDATE admin_inbox SET resolved_at = now() WHERE id = $1", [parsed.data.id]);
  return NextResponse.json({ ok: true });
}
