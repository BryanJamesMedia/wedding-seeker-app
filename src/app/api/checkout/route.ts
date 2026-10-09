import { NextResponse } from "next/server";
import { getCurrentUser, isPaid } from "@/lib/session";
import { billingMode, isStripeConfigured, stripe } from "@/lib/stripe";
import { APP_URL } from "@/lib/urls";
import { safeReturnPath } from "@/lib/utils";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { continueUrl?: string };
  const continuePath = safeReturnPath(body.continueUrl, "/dashboard");
  if (isPaid(user)) return NextResponse.json({ url: continuePath });

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
  }

  const mode = billingMode();
  const session = await stripe().checkout.sessions.create({
    mode,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    ...(user.stripe_customer_id ? { customer: user.stripe_customer_id } : { customer_email: user.email }),
    ...(mode === "payment" && !user.stripe_customer_id ? { customer_creation: "always" as const } : {}),
    success_url: `${APP_URL}${continuePath}${continuePath.includes("?") ? "&" : "?"}checkout=success`,
    cancel_url: `${APP_URL}${continuePath}${continuePath.includes("?") ? "&" : "?"}checkout=cancelled`,
  });
  return NextResponse.json({ url: session.url });
}
