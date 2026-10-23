import { NextResponse, after } from "next/server";
import { query } from "@/db";
import { getCurrentUser, isPaid } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getWeddingProfile } from "@/lib/connections";
import { missingWeddingFields } from "@/lib/wedding-requirements";
import { notifyNewSignup } from "@/lib/signup-notice";
import { isListingType, listingExists, saveListing } from "@/lib/saves";
import { APP_URL } from "@/lib/urls";
import { safeReturnPath } from "@/lib/utils";

/**
 * Landing point after sign-in and after Stripe Checkout. The pending Save /
 * Connect action is stored server-side so it survives the round trip, then
 * completed once the webhook has marked the user paid.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnPath = safeReturnPath(url.searchParams.get("return"), "/search");
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${APP_URL}${returnPath}`);

  if (url.searchParams.get("terms") === "1") {
    await query(
      `UPDATE users SET terms_accepted_at = coalesce(terms_accepted_at, now()),
         marketing_opt_in = marketing_opt_in OR $2 WHERE id = $1`,
      [user.id, url.searchParams.get("marketing") === "1"],
    );
  }

  // Vendor sign-up: only a brand-new account can become a vendor account (one email, one account type).
  if (url.searchParams.get("vendor") === "1" && user.account_type !== "vendor") {
    const [row] = await query<{ used: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM wedding_profiles WHERE user_id = $1)
           OR EXISTS (SELECT 1 FROM saved_listings WHERE user_id = $1)
           OR EXISTS (SELECT 1 FROM saved_searches WHERE user_id = $1)
           OR EXISTS (SELECT 1 FROM connection_requests WHERE user_id = $1) AS used`,
      [user.id],
    );
    if (row?.used) return NextResponse.redirect(`${APP_URL}/vendor/sign-in?error=couple_account`);
    await query("UPDATE users SET account_type = 'vendor' WHERE id = $1", [user.id]);
    user.account_type = "vendor";
  }
  // After the vendor check so the notice has the final account type.
  const userId = user.id;
  after(() => notifyNewSignup(userId));

  if (user.account_type === "vendor") {
    const vendorPath = safeReturnPath(url.searchParams.get("return"), "/vendor");
    return NextResponse.redirect(`${APP_URL}${vendorPath.startsWith("/vendor") ? vendorPath : "/vendor"}`);
  }

  if (isAdmin(user) && !url.searchParams.get("return")) return NextResponse.redirect(`${APP_URL}/admin`);

  const kind = url.searchParams.get("action");
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  if ((kind === "save" || kind === "connect") && isListingType(type) && id) {
    await query(
      `INSERT INTO pending_actions (user_id, action) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET action = EXCLUDED.action, created_at = now()`,
      [user.id, JSON.stringify({ kind, listingType: type, listingId: id })],
    );
  }

  const target = new URL(`${APP_URL}${returnPath}`);
  const checkout = url.searchParams.get("checkout");

  if (!isPaid(user)) {
    if (checkout === "success") {
      // Webhook not processed yet: wait on a page that polls for paid status.
      return NextResponse.redirect(`${APP_URL}/upgrade/processing?return=${encodeURIComponent(url.pathname + url.search)}`);
    }
    if (checkout !== "cancelled") {
      target.searchParams.set("upgrade", "1");
    }
    return NextResponse.redirect(target);
  }

  const [pending] = await query<{ action: { kind: string; listingType: string; listingId: string } }>(
    "DELETE FROM pending_actions WHERE user_id = $1 RETURNING action",
    [user.id],
  );
  if (pending && isListingType(pending.action.listingType)) {
    const ref = { listingType: pending.action.listingType, listingId: pending.action.listingId };
    if (pending.action.kind === "save" && (await listingExists(ref))) {
      await saveListing(user.id, ref);
      target.searchParams.set("toast", checkout === "success" ? "paid_saved" : "saved");
    } else if (pending.action.kind === "connect") {
      target.searchParams.set("connect", `${ref.listingType}:${ref.listingId}`);
      if (checkout === "success") target.searchParams.set("toast", "paid");
    }
  } else if (checkout === "success") {
    target.searchParams.set("toast", "paid");
  }
  // Every sign-in until My Wedding is complete: explain full access + the Connect requirement.
  // A pending Connect opens its own modal, which shows the same requirement.
  if (!target.searchParams.has("connect") && missingWeddingFields(await getWeddingProfile(user.id)).length > 0) {
    target.searchParams.set("welcome", "1");
  }
  return NextResponse.redirect(target);
}
