import "server-only";
import { query, queryOne } from "@/db";
import { getConfig } from "./config";
import { APP_URL, CONNECT_FROM, button, escapeHtml, isProductionEmail, layout, sendAdminNotice, sendEmail, vendorRecipient } from "./email";
import { listingHref } from "./search";
import { signToken } from "./signing";
import type { AppUser } from "./session";
import type { ListingRef } from "./saves";

export const STATUS_LABELS: Record<string, string> = {
  pending_outreach: "Sending soon",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  responded_interested: "Interested",
  responded_unavailable: "Unavailable",
  bounced: "Couldn't deliver",
  created: "Request created",
  replied: "Replied by email",
};

export type WeddingProfile = {
  partner1_name: string | null;
  partner2_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  wedding_date: string | null;
  target_month: number | null;
  target_year: number | null;
  location_text: string | null;
  guest_count: number | null;
  budget_range: string | null;
  settings: string[];
  vibe: string | null;
  vendors_needed: string[];
};

export async function getWeddingProfile(userId: string): Promise<WeddingProfile | null> {
  return queryOne<WeddingProfile>(
    `SELECT partner1_name, partner2_name, contact_email, contact_phone, to_char(wedding_date, 'YYYY-MM-DD') AS wedding_date,
       target_month, target_year, location_text, guest_count, budget_range, settings, vibe, vendors_needed
     FROM wedding_profiles WHERE user_id = $1`,
    [userId],
  );
}

export async function upsertWeddingProfile(userId: string, p: Partial<WeddingProfile>) {
  await query(
    `INSERT INTO wedding_profiles (user_id, partner1_name, partner2_name, contact_email, contact_phone, wedding_date,
       target_month, target_year, location_text, guest_count, budget_range, settings, vibe, vendors_needed)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12,'{}'),$13,coalesce($14,'{}'))
     ON CONFLICT (user_id) DO UPDATE SET partner1_name=$2, partner2_name=$3, contact_email=$4, contact_phone=$5,
       wedding_date=$6, target_month=$7, target_year=$8, location_text=$9, guest_count=$10, budget_range=$11,
       settings=coalesce($12,'{}'), vibe=$13, vendors_needed=coalesce($14,'{}'), updated_at=now()`,
    [
      userId, p.partner1_name ?? null, p.partner2_name ?? null, p.contact_email ?? null, p.contact_phone ?? null,
      p.wedding_date || null, p.target_month ?? null, p.target_year ?? null, p.location_text ?? null,
      p.guest_count ?? null, p.budget_range ?? null, p.settings ?? null, p.vibe ?? null, p.vendors_needed ?? null,
    ],
  );
}

function weddingWhen(p: Partial<WeddingProfile>): string | null {
  if (p.wedding_date) return new Date(`${p.wedding_date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  if (p.target_month && p.target_year) return new Date(p.target_year, p.target_month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return p.target_year ? String(p.target_year) : null;
}

type ConnectListing = {
  listing_type: "venue" | "vendor";
  listing_id: string;
  slug: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  connect_to: string | null;
  unsubscribed_at: Date | null;
};

export class ConnectError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/**
 * Creates a Connect request and emails the vendor (or queues it for the admin
 * when the listing has no deliverable email).
 */
export async function createConnection(user: AppUser, ref: ListingRef, input: { profile: Partial<WeddingProfile>; message: string }) {
  const config = await getConfig();
  const listing = await queryOne<ConnectListing>(
    `SELECT listing_type, listing_id, slug, name, category, city, state, connect_to, unsubscribed_at FROM listings
     WHERE listing_type = $1 AND listing_id = $2 AND status = 'active'`,
    [ref.listingType, ref.listingId],
  );
  if (!listing) throw new ConnectError("Listing not found", 404);

  const [{ count }] = await query<{ count: string }>(
    "SELECT count(*) FROM connection_requests WHERE user_id = $1 AND created_at > now() - interval '1 day'",
    [user.id],
  );
  if (Number(count) >= config.limits.connectsPerDay) {
    throw new ConnectError(`You've reached today's limit of ${config.limits.connectsPerDay} Connect requests. Try again tomorrow.`, 429);
  }

  const optedOut =
    listing.unsubscribed_at != null ||
    (listing.connect_to != null &&
      (await queryOne("SELECT 1 FROM vendor_unsubscribes WHERE email = lower($1)", [listing.connect_to])) != null);
  const deliverable = Boolean(listing.connect_to) && !optedOut;

  const snapshot = { ...input.profile, when: weddingWhen(input.profile) };
  let request: { id: string } | null;
  try {
    request = await queryOne<{ id: string }>(
      `INSERT INTO connection_requests (user_id, listing_type, listing_id, status, message, wedding_snapshot, vendor_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [user.id, ref.listingType, ref.listingId, deliverable ? "sent" : "pending_outreach", input.message.slice(0, 2000), JSON.stringify(snapshot), listing.connect_to],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw new ConnectError("You already have an open request with this listing.", 409);
    throw error;
  }
  const id = request!.id;
  await query("INSERT INTO connection_events (request_id, type) VALUES ($1, 'created')", [id]);

  if (!deliverable) {
    await query(
      "INSERT INTO admin_inbox (kind, listing_type, listing_id, payload) VALUES ('pending_outreach', $1, $2, $3)",
      [ref.listingType, ref.listingId, JSON.stringify({ requestId: id, reason: optedOut ? "vendor unsubscribed" : "no email on file" })],
    );
    await sendAdminNotice(`Pending outreach: ${listing.name}`, { listing: listing.name, request: id, reason: optedOut ? "vendor unsubscribed" : "no email on file" });
    return { id, status: "pending_outreach" as const };
  }

  const emailId = await sendVendorEmail(id, listing, user, snapshot, input.message, config.limits.shareContactInFirstEmail);
  if (emailId) await query("UPDATE connection_requests SET resend_email_id = $2 WHERE id = $1", [id, emailId]);
  return { id, status: "sent" as const };
}

async function sendVendorEmail(
  requestId: string,
  listing: ConnectListing,
  user: AppUser,
  snapshot: Partial<WeddingProfile> & { when: string | null },
  message: string,
  shareContact: boolean,
) {
  const couple = [snapshot.partner1_name, snapshot.partner2_name].filter(Boolean).join(" & ") || "A couple";
  const respond = (answer: "interested" | "unavailable") => `${APP_URL}/r/${signToken({ r: requestId, a: answer })}`;
  const unsubscribe = `${APP_URL}/r/unsubscribe/${signToken({ e: listing.connect_to, l: `${listing.listing_type}:${listing.listing_id}` }, 3650)}`;
  const rows: [string, string | null | undefined][] = [
    ["Date", snapshot.when],
    ["Location", snapshot.location_text],
    ["Guests", snapshot.guest_count ? String(snapshot.guest_count) : null],
    ["Budget", snapshot.budget_range],
    ["Setting", snapshot.settings?.join(", ")],
    ["Vibe", snapshot.vibe],
  ];
  if (shareContact) rows.push(["Email", snapshot.contact_email ?? user.email], ["Phone", snapshot.contact_phone]);
  const table = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6f655e">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`)
    .join("");
  const html = layout(
    `<h1 style="font-family:Georgia,serif;font-weight:600">${escapeHtml(couple)} would like to hear from ${escapeHtml(listing.name)}</h1>
     <p>They found you on Wedding Seeker and sent their wedding details:</p>
     <table style="border-collapse:collapse;margin:12px 0">${table}</table>
     ${message ? `<p style="white-space:pre-line;border-left:3px solid #e8e0d8;padding-left:12px">${escapeHtml(message)}</p>` : ""}
     <p>Are you available?</p>
     <p>${button(respond("interested"), "Yes, I'm interested")} &nbsp; ${button(respond("unavailable"), "Not available", "#6f655e")}</p>
     <p style="color:#6f655e;font-size:13px">Clicking “interested” shares the couple's contact details with you. You can also reply to this email.</p>`,
    `<a href="${unsubscribe}" style="color:#6f655e">Stop receiving couple requests</a> · <a href="${APP_URL}${listingHref(listing)}" style="color:#6f655e">Your listing</a>`,
  );
  const inbound = process.env.INBOUND_REPLY_DOMAIN;
  return sendEmail({
    to: vendorRecipient(listing.connect_to!),
    from: CONNECT_FROM,
    subject: `${isProductionEmail() ? "" : "[TEST] "}Wedding inquiry from ${couple}${snapshot.when ? ` · ${snapshot.when}` : ""}`,
    html,
    replyTo: inbound ? `reply+${requestId}@${inbound}` : undefined,
    headers: {
      "List-Unsubscribe": `<${unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-Entity-Ref-ID": requestId,
    },
  });
}

/** Moves a request to a new status, keeping responded/bounced terminal. */
export async function setConnectionStatus(requestId: string, status: string, detail?: Record<string, unknown>) {
  const order = ["pending_outreach", "sent", "delivered", "opened"];
  const row = await queryOne<{ status: string; user_id: string | null }>(
    "SELECT status, user_id FROM connection_requests WHERE id = $1",
    [requestId],
  );
  if (!row) return null;
  const terminal = !order.includes(row.status);
  const regress = order.includes(status) && order.indexOf(status) <= order.indexOf(row.status);
  await query("INSERT INTO connection_events (request_id, type, detail) VALUES ($1, $2, $3)", [requestId, status, detail ? JSON.stringify(detail) : null]);
  if ((terminal && status !== "bounced") || regress || (terminal && row.status.startsWith("responded"))) return row;
  await query(
    `UPDATE connection_requests SET status = $2, updated_at = now(),
       responded_at = CASE WHEN $2 LIKE 'responded%' THEN coalesce(responded_at, now()) ELSE responded_at END
     WHERE id = $1`,
    [requestId, status],
  );
  return { ...row, status };
}

export async function notifyCoupleOfResponse(requestId: string) {
  const row = await queryOne<{ email: string; name: string; status: string; email_connect_confirmations: boolean }>(
    `SELECT u.email, l.name, c.status, u.email_connect_confirmations FROM connection_requests c
     JOIN users u ON u.id = c.user_id JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
     WHERE c.id = $1`,
    [requestId],
  );
  if (!row || !row.email_connect_confirmations) return;
  const interested = row.status === "responded_interested";
  await sendEmail({
    to: row.email,
    subject: interested ? `${row.name} is interested in your wedding` : `${row.name} replied to your request`,
    html: layout(
      `<h1 style="font-family:Georgia,serif;font-weight:600">${escapeHtml(row.name)} ${interested ? "is interested!" : "isn't available"}</h1>
       <p>${interested ? "They now have your contact details and should reach out soon." : "Don't worry — there are plenty of other great options."}</p>
       <p>${button(`${APP_URL}/dashboard/connections`, "View your connections")}</p>`,
    ),
  });
}
