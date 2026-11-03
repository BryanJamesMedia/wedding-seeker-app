import { getBalance } from "@/lib/leads";
import { confirmTopUp } from "@/lib/stripe";
import { formatDate, formatMoney } from "@/lib/utils";
import { requireVendor } from "@/lib/vendor-auth";
import { listWalletTransactions, TOP_UP_AMOUNTS_CENTS, type WalletTransaction } from "@/lib/wallet";
import { TopUpButtons } from "./top-up";

const KIND_LABEL: Record<WalletTransaction["kind"], string> = { top_up: "Top-up", purchase: "Lead purchase", adjustment: "Adjustment" };

function describe(t: WalletTransaction): string {
  if (t.kind === "top_up") return "Wallet top-up (card)";
  if (t.kind === "adjustment") return t.amount_cents > 0 ? "Credit from Wedding Seeker" : "Adjustment by Wedding Seeker";
  return t.description ?? "Lead purchase";
}

const signed = (cents: number) => `${cents > 0 ? "+" : "−"}${formatMoney(Math.abs(cents))}`;

export default async function WalletPage({ searchParams }: PageProps<"/vendor/wallet">) {
  const user = await requireVendor("/vendor/wallet");
  const { top_up, session_id } = await searchParams;
  const confirmed = top_up === "success" && typeof session_id === "string"
    ? await confirmTopUp(session_id, user.id).catch((error) => {
        console.error("[wallet] couldn't confirm top-up", error);
        return null;
      })
    : null;
  const [balance, transactions] = await Promise.all([getBalance(user.id), listWalletTransactions(user.id)]);
  const topUps = transactions.filter((t) => t.kind === "top_up" || (t.kind === "adjustment" && t.amount_cents > 0));

  const notice =
    top_up === "cancelled" ? "Top-up cancelled. You weren't charged."
    : confirmed === "paid" ? "Payment received. Your wallet has been topped up."
    : top_up === "success" ? "Thanks! Your payment is processing. The credit will appear here as soon as it clears."
    : null;

  const th = "px-3 py-2";
  const td = "px-3 py-2 whitespace-nowrap";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Wallet</h1>
        <p className="text-sm text-muted">Use your wallet credit to purchase connection requests from couples.</p>
      </div>
      {notice ? <p role="status" className="rounded-2xl bg-accent-soft p-4 text-sm">{notice}</p> : null}
      <section aria-label="Balance" className="grid gap-6 rounded-3xl border border-border bg-card p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="sm:border-r sm:border-border sm:pr-8">
          <p className="text-sm text-muted">Wallet balance</p>
          <p className="text-4xl font-semibold">{formatMoney(balance)}</p>
        </div>
        <TopUpButtons amounts={TOP_UP_AMOUNTS_CENTS} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="top-ups-heading">
          <h2 id="top-ups-heading" className="mb-2 text-lg font-semibold">Top-ups</h2>
          {topUps.length ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-border bg-accent-soft text-xs uppercase tracking-wide text-muted">
                  <tr><th scope="col" className={th}>Date</th><th scope="col" className={th}>Method</th><th scope="col" className={`${th} text-right`}>Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topUps.map((t) => (
                    <tr key={t.id}>
                      <td className={td}>{formatDate(t.created_at)}</td>
                      <td className={td}>{t.kind === "top_up" ? "Card" : "Credit from Wedding Seeker"}</td>
                      <td className={`${td} text-right font-medium`}>{formatMoney(t.amount_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">No top-ups yet.</p>
          )}
        </section>

        <section aria-labelledby="transactions-heading">
          <h2 id="transactions-heading" className="mb-2 text-lg font-semibold">All transactions</h2>
          {transactions.length ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-border bg-accent-soft text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className={th}>Date</th>
                    <th scope="col" className={th}>Type</th>
                    <th scope="col" className={th}>Description</th>
                    <th scope="col" className={`${th} text-right`}>Amount</th>
                    <th scope="col" className={`${th} text-right`}>Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className={td}>{formatDate(t.created_at)}</td>
                      <td className={td}>{KIND_LABEL[t.kind]}</td>
                      <td className="min-w-40 px-3 py-2">{describe(t)}</td>
                      <td className={`${td} text-right font-medium ${t.amount_cents > 0 ? "text-emerald-700" : ""}`}>{signed(t.amount_cents)}</td>
                      <td className={`${td} text-right text-muted`}>{formatMoney(t.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">No transactions yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
