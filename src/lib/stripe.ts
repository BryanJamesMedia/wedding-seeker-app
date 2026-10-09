import "server-only";
import Stripe from "stripe";
import { query, queryOne } from "@/db";
import { sendWelcomeEmail } from "./email";

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/**
 * Billing model is switchable by config: `STRIPE_BILLING_MODE=payment` for a
 * one-time "access until your wedding" price, `subscription` for monthly.
 */
export function billingMode(): "payment" | "subscription" {
  return process.env.STRIPE_BILLING_MODE === "subscription" ? "subscription" : "payment";
}

/** One-time access length in days (`payment` mode). Default ~18 months. */
function oneTimeAccessDays(): number {
  return Number(process.env.ONE_TIME_ACCESS_DAYS ?? 548);
}

async function markPaid(userId: string, fields: { customerId?: string | null; subscriptionId?: string | null; paidUntil: Date | null }) {
  const before = await queryOne<{ plan_status: string; email: string }>(
    "SELECT plan_status, email FROM users WHERE id = $1",
    [userId],
  );
  await query(
    `UPDATE users SET plan_status = 'paid', paid_until = $2,
       stripe_customer_id = coalesce($3, stripe_customer_id),
       stripe_subscription_id = coalesce($4, stripe_subscription_id), updated_at = now()
     WHERE id = $1`,
    [userId, fields.paidUntil, fields.customerId ?? null, fields.subscriptionId ?? null],
  );
  if (before && before.plan_status !== "paid") void sendWelcomeEmail(before.email);
}

/** Webhook handler: the only place paid status is granted or removed. */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.userId;
      if (!userId || session.payment_status === "unpaid") return;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (session.mode === "subscription") {
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        await markPaid(userId, { customerId, subscriptionId, paidUntil: null });
      } else {
        await markPaid(userId, { customerId, paidUntil: new Date(Date.now() + oneTimeAccessDays() * 86_400_000) });
      }
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const active = event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(sub.status);
      await query(
        `UPDATE users SET plan_status = $2, stripe_subscription_id = $3, updated_at = now()
         WHERE stripe_customer_id = $1`,
        [typeof sub.customer === "string" ? sub.customer : sub.customer.id, active ? "paid" : "unpaid", sub.id],
      );
      return;
    }
  }
}
