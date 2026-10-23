import { requireAdmin } from "@/lib/admin";
import { getOverview } from "@/lib/admin-data";
import { formatMoney } from "@/lib/utils";
import { BarChart, Stat } from "./chart";

export default async function AdminPage() {
  await requireAdmin();
  const { stats: s, series, topSearches } = await getOverview();
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold">Overview</h1>
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Couples" value={s.couples} href="/admin/couples" />
        <Stat label="Vendors" value={s.vendors} href="/admin/vendors" />
        <Stat label="Pending claims" value={s.pending_claims} href="/admin/claims" />
        <Stat label="Pending add requests" value={s.pending_adds} href="/admin/add-requests" />
        <Stat label={`Connection requests (${s.connections_30d} in 30d)`} value={s.connections} href="/admin/connections" />
        <Stat label="Leads purchased" value={s.leads} />
        <Stat label="Lead revenue" value={formatMoney(s.lead_revenue)} />
        <Stat label="Wallet top-ups" value={formatMoney(s.top_ups)} />
        <Stat label="Searches (7d)" value={s.searches_7d} />
      </section>
      <section aria-label="Last 30 days" className="grid gap-3 lg:grid-cols-3">
        <BarChart title="Couple sign-ups" data={series.map((d) => ({ day: d.day, value: d.couples }))} />
        <BarChart title="Vendor sign-ups" data={series.map((d) => ({ day: d.day, value: d.vendors }))} />
        <BarChart title="Connection requests" data={series.map((d) => ({ day: d.day, value: d.connections }))} />
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Top searches (30d)</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm">
          {topSearches.length === 0 ? <li className="list-none text-muted">No searches yet.</li> : null}
          {topSearches.map((t) => <li key={t.q}>{t.q || "(any)"} — {t.n}</li>)}
        </ol>
      </section>
    </div>
  );
}
