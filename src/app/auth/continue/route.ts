import { NextResponse } from "next/server";
import { query } from "@/db";
import { getCurrentUser, isPaid } from "@/lib/session";
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
  return NextResponse.redirect(target);
}
