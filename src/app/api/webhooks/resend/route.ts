import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { queryOne } from "@/db";
import { setConnectionStatus } from "@/lib/connections";

const MAP: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.complained": "bounced",
};

/** Resend delivery events → Connect request status. */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const payload = await request.text();
  let event: { type: string; data: { email_id?: string } };
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    }) as unknown as typeof event;
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const status = MAP[event.type];
  if (!status || !event.data.email_id) return NextResponse.json({ ok: true });
  const row = await queryOne<{ id: string }>("SELECT id FROM connection_requests WHERE resend_email_id = $1", [event.data.email_id]);
  if (row) await setConnectionStatus(row.id, status, { via: "resend", event: event.type });
  return NextResponse.json({ ok: true });
}
