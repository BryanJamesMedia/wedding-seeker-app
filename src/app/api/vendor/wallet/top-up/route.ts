import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { stripe } from "@/lib/stripe";
import { APP_URL } from "@/lib/urls";
import { TOP_UP_AMOUNTS_CENTS, WALLET_TOP_UP } from "@/lib/wallet";

const Body = z.object({ amountCents: z.number().int().refine((n) => (TOP_UP_AMOUNTS_CENTS as readonly number[]).includes(n)) });

export async function POST(request: Request) {
  const limited = await rateLimit(request, "wallet-top-up", 10);
  if (limited) return limited;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.account_type !== "vendor") return NextResponse.json({ error: "Only vendor accounts have a wallet." }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a top-up amount." }, { status: 400 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });

  const metadata = { purpose: WALLET_TOP_UP, userId: user.id };
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: { currency: "usd", unit_amount: parsed.data.amountCents, product_data: { name: "Wedding Seeker wallet credit" } },
    }],
    client_reference_id: user.id,
    metadata,
    payment_intent_data: { metadata, description: "Wedding Seeker wallet credit" },
    ...(user.stripe_customer_id ? { customer: user.stripe_customer_id } : { customer_email: user.email }),
    success_url: `${APP_URL}/vendor/wallet?top_up=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/vendor/wallet?top_up=cancelled`,
  });
  return NextResponse.json({ url: session.url });
}
