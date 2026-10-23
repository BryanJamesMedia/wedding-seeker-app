import { NextResponse, after } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/db";
import { getAdmin } from "@/lib/admin";
import { notifyListingRequestDecision } from "@/lib/review-notice";

const Body = z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]) });

export async function POST(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id, decision } = parsed.data;
  const current = await queryOne<{ status: string }>("SELECT status FROM listing_requests WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (current.status === decision) return NextResponse.json({ ok: true, changed: false });
  try {
    await query(decision === "approved" ? "SELECT approve_listing_request($1)" : "SELECT reject_listing_request($1)", [id]);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This listing already has an approved owner." }, { status: 409 });
    }
    throw err;
  }
  after(() => notifyListingRequestDecision(id, decision));
  return NextResponse.json({ ok: true, changed: true });
}
