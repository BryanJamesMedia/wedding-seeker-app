import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { APP_URL } from "@/lib/urls";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/sign-in`, 303);
  if (!isStripeConfigured() || !user.stripe_customer_id) {
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?billing=unavailable`, 303);
  }
  const portal = await stripe().billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${APP_URL}/dashboard/settings`,
  });
  return NextResponse.redirect(portal.url, 303);
}
