import { requireUser, isPaid } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { SettingsForm } from "./form";

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  const paid = isPaid(user);
  return (
    <div className="max-w-xl space-y-8">
      <h1 className="font-serif text-4xl font-semibold">Settings</h1>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-2xl font-semibold">Plan</h2>
        <p className="mt-1 text-sm">{paid ? `Wedding Seeker Plus${user.paid_until ? ` · until ${formatDate(user.paid_until)}` : ""}` : "Free"}</p>
        {paid && user.stripe_customer_id ? (
          <form action="/api/billing-portal" method="post" className="mt-3">
            <button className="rounded-full border border-border px-4 py-2 text-sm">Manage billing</button>
          </form>
        ) : null}
      </section>
      <SettingsForm
        initial={{
          email_connect_confirmations: user.email_connect_confirmations,
          email_saved_search_alerts: user.email_saved_search_alerts,
          marketing_opt_in: user.marketing_opt_in,
        }}
      />
    </div>
  );
}
