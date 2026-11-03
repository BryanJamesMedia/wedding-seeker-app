import "server-only";
import type Stripe from "stripe";
import { query } from "@/db";

export const WALLET_TOP_UP = "wallet_top_up";
export const TOP_UP_AMOUNTS_CENTS = [1000, 2500, 5000, 10000] as const;

export type WalletTransaction = {
  id: string;
  created_at: Date;
  amount_cents: number;
  kind: "top_up" | "purchase" | "adjustment";
  description: string | null;
  balance_after: number;
};

export async function listWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  return query<WalletTransaction>(
    `SELECT * FROM (
       SELECT id, created_at, amount_cents, kind, description,
              sum(amount_cents) OVER (ORDER BY created_at, id)::int AS balance_after
       FROM wallet_transactions WHERE user_id = $1
     ) t ORDER BY created_at DESC, id DESC LIMIT 500`,
    [userId],
  );
}

/**
 * Adds a paid Checkout top-up to the vendor's wallet. Safe to call from both the webhook and
 * the success page: stripe_session_id is unique, so a session is only ever credited once.
 */
export async function creditTopUp(session: Stripe.Checkout.Session): Promise<boolean> {
  const userId = session.metadata?.userId;
  const amount = session.amount_total ?? 0;
  if (session.metadata?.purpose !== WALLET_TOP_UP || !userId || session.payment_status !== "paid" || amount <= 0) return false;
  await query(
    `INSERT INTO wallet_transactions (user_id, amount_cents, kind, description, stripe_session_id)
     SELECT id, $2, 'top_up', 'Wallet top-up', $3 FROM users WHERE id = $1 AND account_type = 'vendor'
     ON CONFLICT (stripe_session_id) DO NOTHING`,
    [userId, amount, session.id],
  );
  return true;
}
