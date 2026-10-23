import { queryOne } from "@/db";
import { categoryLabel } from "@/lib/categories";
import { listingHref } from "@/lib/search";
import { APP_URL, SIGNUP_NOTIFY_EMAIL, escapeHtml, layout, sendEmail } from "./email";

type ClaimRow = {
  id: string;
  listing_type: string;
  listing_id: string;
  claimant_name: string;
  claimant_role: string;
  claimant_phone: string;
  note: string | null;
  created_at: Date;
  account_email: string;
  name: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  slug: string | null;
  phone_1: string | null;
  connect_to: string | null;
  domain: string | null;
};

/** Emails the team about a claim waiting for review, with the SQL to approve or reject it. */
export async function notifyClaimSubmitted(claimId: string, isNew: boolean): Promise<void> {
  const c = await queryOne<ClaimRow>(
    `SELECT c.id, c.listing_type, c.listing_id, c.claimant_name, c.claimant_role, c.claimant_phone, c.note, c.created_at,
       u.email AS account_email, l.name, l.category, l.city, l.state, l.slug, l.phone_1, l.connect_to, l.domain
     FROM listing_claims c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
     WHERE c.id = $1`,
    [claimId],
  );
  if (!c) return;
  const listingName = c.name ?? `${c.listing_type} ${c.listing_id}`;
  const type = c.listing_type === "venue" ? "Venue" : c.category ? `Vendor (${categoryLabel(c.category)})` : "Vendor";
  const link = c.slug ? `${APP_URL}${listingHref({ ...c, slug: c.slug })}` : null;
  const when = new Date(c.created_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
  const section = (title: string, rows: [string, string | null | undefined][]) =>
    `<h2 style="font-size:16px;margin:20px 0 6px">${escapeHtml(title)}</h2>` +
    rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<p style="margin:4px 0"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`)
      .join("");
  const sql = (status: string) =>
    `UPDATE listing_claims SET status = '${status}', reviewed_at = now() WHERE id = '${c.id}';`;
  const subject = `${isNew ? "New" : "Updated"} listing claim: ${listingName}`;
  await sendEmail({
    to: SIGNUP_NOTIFY_EMAIL,
    subject,
    html: layout(
      `<h1 style="font-size:20px;font-weight:normal">${escapeHtml(subject)}</h1>` +
        section("Listing", [
          ["Name", listingName],
          ["Type", type],
          ["Location", [c.city, c.state].filter(Boolean).join(", ")],
          ["Phone on file", c.phone_1],
          ["Email on file", c.connect_to],
          ["Website", c.domain],
          ["Page", link],
        ]) +
        section("Claimed by", [
          ["Name", c.claimant_name],
          ["Role", c.claimant_role],
          ["Phone", c.claimant_phone],
          ["Account email", c.account_email],
          ["Note", c.note],
          ["Submitted", `${when} ET`],
        ]) +
        `<h2 style="font-size:16px;margin:20px 0 6px">Review in Neon</h2>` +
        `<p style="margin:4px 0">Approve:</p><pre style="background:#f4f4f4;padding:8px;white-space:pre-wrap">${escapeHtml(sql("approved"))}</pre>` +
        `<p style="margin:4px 0">Reject:</p><pre style="background:#f4f4f4;padding:8px;white-space:pre-wrap">${escapeHtml(sql("rejected"))}</pre>`,
    ),
  });
}
