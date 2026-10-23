import "server-only";
import { query, queryOne, withTransaction } from "@/db";
import type { ListingType } from "@/lib/categories";
import { categoryLabel } from "@/lib/categories";
import { APP_URL, SIGNUP_NOTIFY_EMAIL, button, escapeHtml, layout, sendEmail } from "@/lib/email";
import { listingHref } from "@/lib/search";

export const MAX_PENDING_REQUESTS = 5;

export type ListingRequestInput = {
  listingType: ListingType;
  category: string | null;
  name: string;
  address: string | null;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string | null;
  description: string | null;
};

export type PossibleDuplicate = {
  listing_type: ListingType;
  listing_id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  slug: string;
};

const normalizedName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const digits = (phone: string) => phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/** Live listings with a similar name in the same city/ZIP, or the same phone number. */
export async function findPossibleDuplicates(input: ListingRequestInput): Promise<PossibleDuplicate[]> {
  return query<PossibleDuplicate>(
    `SELECT listing_type, listing_id, name, category, city, state, slug FROM (
       SELECT l.*, regexp_replace(lower(l.name), '[^a-z0-9]', '', 'g') AS n,
         right(regexp_replace(coalesce(l.phone_1, ''), '\\D', '', 'g'), 10) AS p
       FROM listings l WHERE l.status = 'active' AND l.slug IS NOT NULL
     ) l
     WHERE (length($1) >= 3 AND length(n) >= 3 AND (n LIKE '%' || $1 || '%' OR $1 LIKE '%' || n || '%')
            AND upper(btrim(l.state)) = $2 AND (lower(btrim(l.city)) = lower($3) OR left(btrim(l.zip), 5) = $4))
        OR (length($5) = 10 AND p = $5)
     ORDER BY (n = $1) DESC, name LIMIT 5`,
    [normalizedName(input.name), input.state, input.city, input.zip.slice(0, 5), digits(input.phone)],
  );
}

export async function countPendingRequests(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    "SELECT count(*) AS count FROM listing_requests WHERE user_id = $1 AND status = 'pending'",
    [userId],
  );
  return Number(row?.count ?? 0);
}

/** Inserts the hidden listing, the request, and the requester's pending claim in one transaction. */
export async function createListingRequest(
  user: { id: string; name: string },
  input: ListingRequestInput,
): Promise<{ requestId: string; listingId: string }> {
  const table = input.listingType === "venue" ? "venues" : "vendors";
  return withTransaction(async (db) => {
    const listing = await db.query<{ id: string }>(
      `INSERT INTO ${table} (name, category, address, city, state, zip, phone_1, email_1, domain, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending') RETURNING id::text AS id`,
      [input.name, input.category, input.address, input.city, input.state, input.zip, input.phone, input.email, input.website, input.description],
    );
    const listingId = listing.rows[0].id;
    const request = await db.query<{ id: string }>(
      "INSERT INTO listing_requests (user_id, listing_type, listing_id) VALUES ($1, $2, $3) RETURNING id",
      [user.id, input.listingType, listingId],
    );
    await db.query(
      `INSERT INTO listing_claims (user_id, listing_type, listing_id, claimant_name, claimant_role, claimant_phone, note)
       VALUES ($1, $2, $3, $4, 'Added this listing', $5, 'Requested to add this listing')`,
      [user.id, input.listingType, listingId, user.name || input.name, input.phone],
    );
    return { requestId: request.rows[0].id, listingId };
  });
}

const row = (k: string, v: string | null | undefined) =>
  v ? `<p style="margin:4px 0"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>` : "";
const heading = (title: string) => `<h2 style="font-size:16px;margin:20px 0 6px">${escapeHtml(title)}</h2>`;
const code = (sql: string) => `<pre style="background:#f4f4f4;padding:8px;white-space:pre-wrap">${escapeHtml(sql)}</pre>`;

/** Team notice with the review SQL, plus a confirmation to the listing email the vendor entered. */
export async function notifyListingRequest(args: {
  requestId: string;
  input: ListingRequestInput;
  account: { email: string; name: string };
  duplicates: PossibleDuplicate[];
}): Promise<void> {
  const { requestId, input, account, duplicates } = args;
  const kind = input.listingType === "venue" ? "Venue" : "Vendor";
  const subject = `Request to Add a ${kind}: ${input.name}`;
  const dupes = duplicates.length
    ? heading("Possible duplicates (they chose to submit anyway)") +
      duplicates
        .map((d) => `<p style="margin:4px 0">${escapeHtml(d.name)} · ${escapeHtml([d.city, d.state].filter(Boolean).join(", "))} · ${escapeHtml(`${APP_URL}${listingHref(d)}`)}</p>`)
        .join("")
    : "";
  const team = sendEmail({
    to: SIGNUP_NOTIFY_EMAIL,
    subject,
    html: layout(
      `<h1 style="font-size:20px;font-weight:normal">${escapeHtml(subject)}</h1>` +
        heading("Listing") +
        row("Type", input.category ? `${kind} (${categoryLabel(input.category)})` : kind) +
        row("Name", input.name) +
        row("Address", input.address) +
        row("Location", `${input.city}, ${input.state} ${input.zip}`) +
        row("Phone", input.phone) +
        row("Listing email", input.email) +
        row("Website", input.website) +
        row("Description", input.description) +
        heading("Requested by") +
        row("Account email", account.email) +
        row("Account name", account.name) +
        dupes +
        heading("Review in Neon") +
        `<p style="margin:4px 0">Approve (goes live, and they become the owner):</p>${code(`SELECT approve_listing_request('${requestId}');`)}` +
        `<p style="margin:4px 0">Reject:</p>${code(`SELECT reject_listing_request('${requestId}');`)}`,
    ),
  });
  const vendor = sendEmail({
    to: input.email,
    subject: `We received your request to add ${input.name}`,
    html: layout(
      `<h1 style="font-size:20px;font-weight:normal">Thanks! We received your request.</h1>` +
        `<p>You asked to add <strong>${escapeHtml(input.name)}</strong> (${escapeHtml(`${input.city}, ${input.state}`)}) to Wedding Seeker.</p>` +
        `<p>We review every new listing by hand, usually within 1–2 business days. Once it's approved, your listing goes live and you can edit it and receive connection requests from couples in your vendor dashboard.</p>` +
        button(`${APP_URL}/vendor`, "Go to your dashboard"),
    ),
  });
  await Promise.all([team, vendor]);
}
