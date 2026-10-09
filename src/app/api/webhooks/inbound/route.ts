import { NextResponse } from "next/server";
import { query, queryOne } from "@/db";
import { notifyCoupleOfResponse, setConnectionStatus } from "@/lib/connections";
import { sendAdminNotice } from "@/lib/email";

/**
 * Inbound vendor replies (reply+<requestId>@INBOUND_REPLY_DOMAIN), forwarded by
 * the email provider as JSON { to, from, subject, text }. Protected by INBOUND_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.INBOUND_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { to?: string | string[]; from?: string; subject?: string; text?: string } | null;
  const to = ([] as string[]).concat(body?.to ?? []).join(",");
  const id = to.match(/reply\+([0-9a-f-]{36})@/i)?.[1];
  if (!id) return NextResponse.json({ ok: true, matched: false });
  const row = await queryOne<{ status: string }>("SELECT status FROM connection_requests WHERE id = $1", [id]);
  if (!row) return NextResponse.json({ ok: true, matched: false });
  await query("INSERT INTO connection_events (request_id, type, detail) VALUES ($1, 'replied', $2)", [
    id,
    JSON.stringify({ from: body?.from, subject: body?.subject, text: body?.text?.slice(0, 5000) }),
  ]);
  if (!row.status.startsWith("responded")) {
    await setConnectionStatus(id, "responded_interested", { via: "email" });
    await notifyCoupleOfResponse(id);
  }
  await sendAdminNotice("Vendor replied by email", { request: id, from: body?.from, subject: body?.subject });
  return NextResponse.json({ ok: true, matched: true });
}
