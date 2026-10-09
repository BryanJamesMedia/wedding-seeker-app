import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { queryOne } from "@/db";
import { auth } from "./auth";
import type { Viewer } from "./gating";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  plan_status: "unpaid" | "paid";
  paid_until: Date | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  marketing_opt_in: boolean;
  terms_accepted_at: Date | null;
  email_connect_confirmations: boolean;
  email_saved_search_alerts: boolean;
  is_admin: boolean;
};

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** The signed-in user's app row; paid status is always read from the database. */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const session = await getSession();
  if (!session?.user) return null;
  return queryOne<AppUser>(
    `SELECT id, email, name, plan_status, paid_until, stripe_customer_id, stripe_subscription_id,
            marketing_opt_in, terms_accepted_at, email_connect_confirmations, email_saved_search_alerts, is_admin
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [session.user.id],
  );
});

export function isPaid(user: AppUser | null): boolean {
  if (!user || user.plan_status !== "paid") return false;
  return !user.paid_until || new Date(user.paid_until).getTime() > Date.now();
}

export async function getViewer(): Promise<Viewer & { user: AppUser | null }> {
  const user = await getCurrentUser();
  return { userId: user?.id ?? null, paid: isPaid(user), user };
}

export async function requireUser(next = "/dashboard"): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}
