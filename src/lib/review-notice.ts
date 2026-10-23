import "server-only";
import { queryOne } from "@/db";
import { listingHref } from "@/lib/search";
import { APP_URL, button, escapeHtml, layout, sendEmail } from "./email";

export const SUPPORT_EMAIL = "support@weddingseeker.com";
export type Decision = "approved" | "rejected";

type Target = { to: string | null; name: string | null; listing_type: string; category: string | null; city: string | null; state: string | null; slug: string | null };

const denied = (what: string) =>
  `<p>${what} was denied. Please contact support at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`;

/** Tells the vendor (at their login email) whether their listing claim was approved. */
export async function notifyClaimDecision(claimId: string, decision: Decision): Promise<void> {
  const c = await queryOne<Target>(
    `SELECT u.email AS to, l.name, c.listing_type, l.category, l.city, l.state, l.slug
     FROM listing_claims c JOIN users u ON u.id = c.user_id
     LEFT JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
     WHERE c.id = $1`,
    [claimId],
  );
  if (!c?.to) return;
  const name = c.name ?? "your listing";
  const approved = decision === "approved";
  const subject = approved ? `Your claim for ${name} was approved` : `Your claim for ${name} was denied`;
  const body = approved
    ? `<p>You now manage <strong>${escapeHtml(name)}</strong> on Wedding Seeker. You can edit your listing and see connection requests from couples in your vendor dashboard.</p>` +
      `<p>${button(`${APP_URL}/vendor/listings`, "Edit your listing")}</p>`
    : denied(`Your claim for <strong>${escapeHtml(name)}</strong>`);
  await sendEmail({ to: c.to, subject, html: layout(`<h1 style="font-size:22px;font-weight:normal">${escapeHtml(subject)}</h1>${body}`) });
}

/** Tells the requester, at the listing email they entered, whether their new listing was approved. */
export async function notifyListingRequestDecision(requestId: string, decision: Decision): Promise<void> {
  const r = await queryOne<Target>(
    `SELECT coalesce(nullif(l.connect_to, ''), u.email) AS to, l.name, r.listing_type, l.category, l.city, l.state, l.slug
     FROM listing_requests r JOIN users u ON u.id = r.user_id
     LEFT JOIN listings l ON l.listing_type = r.listing_type AND l.listing_id = r.listing_id
     WHERE r.id = $1`,
    [requestId],
  );
  if (!r?.to) return;
  const name = r.name ?? "your listing";
  const approved = decision === "approved";
  const subject = approved ? `${name} is now live on Wedding Seeker` : `Your request to add ${name} was denied`;
  const page = r.slug ? `${APP_URL}${listingHref({ ...r, slug: r.slug })}` : null;
  const body = approved
    ? `<p>Your request to add <strong>${escapeHtml(name)}</strong> was approved. It's now live on Wedding Seeker, and you manage it from your vendor dashboard.</p>` +
      `<p>${page ? button(page, "View your listing") : ""}${button(`${APP_URL}/vendor/listings`, "Edit your listing", "#2b2622")}</p>`
    : denied(`Your request to add <strong>${escapeHtml(name)}</strong>`);
  await sendEmail({ to: r.to, subject, html: layout(`<h1 style="font-size:22px;font-weight:normal">${escapeHtml(subject)}</h1>${body}`) });
}
