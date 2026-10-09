import { query } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import { CONFIG_KEYS } from "@/lib/config-defaults";
import { formatDate } from "@/lib/utils";
import { ConfigEditor, ResolveButton } from "./client";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  await requireAdmin();
  const [config, stats, inbox, topSearches] = await Promise.all([
    getConfig(),
    query<{ users: string; paid: string; connections: string; responses: string; searches: string }>(
      `SELECT (SELECT count(*) FROM users) AS users,
              (SELECT count(*) FROM users WHERE plan_status = 'paid') AS paid,
              (SELECT count(*) FROM connection_requests) AS connections,
              (SELECT count(*) FROM connection_requests WHERE status LIKE 'responded%') AS responses,
              (SELECT count(*) FROM search_logs WHERE created_at > now() - interval '7 days') AS searches`,
    ),
    query<{ id: string; kind: string; listing_type: string | null; listing_id: string | null; payload: Record<string, unknown>; created_at: string; name: string | null }>(
      `SELECT a.*, l.name FROM admin_inbox a
       LEFT JOIN listings l ON l.listing_type = a.listing_type AND l.listing_id::text = a.listing_id
       WHERE a.resolved_at IS NULL ORDER BY a.created_at DESC LIMIT 100`,
    ),
    query<{ q: string; n: string }>(
      `SELECT concat_ws(' · ', nullif(array_to_string(categories, ', '), ''), location_text) AS q, count(*) AS n
       FROM search_logs WHERE created_at > now() - interval '30 days'
       GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    ),
  ]);
  const s = stats[0];
  const entries: [string, string, unknown][] = [
    ["Ranking weights", CONFIG_KEYS.ranking, config.ranking],
    ["Match labels", CONFIG_KEYS.matchLabels, config.matchLabels],
    ["Limits", CONFIG_KEYS.limits, config.limits],
    ["Field visibility (free / registered / paid)", CONFIG_KEYS.fieldVisibility, config.fieldVisibility],
    ["Search filters", CONFIG_KEYS.filters, config.filters],
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <h1 className="font-serif text-4xl font-semibold">Admin</h1>
      <section aria-label="Stats" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[["Users", s.users], ["Plus members", s.paid], ["Connect requests", s.connections], ["Vendor responses", s.responses], ["Searches (7d)", s.searches]].map(([label, n]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-2xl font-semibold">{n}</p>
            <p className="text-sm text-muted">{label}</p>
          </div>
        ))}
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Inbox ({inbox.length})</h2>
        <p className="text-sm text-muted">Connect requests for vendors with no email on file, plus claims and reports. Contact the vendor manually, then resolve.</p>
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {inbox.length === 0 ? <li className="p-4 text-sm text-muted">Nothing to do.</li> : null}
          {inbox.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">{item.kind.replace("_", " ")} · {item.name ?? `${item.listing_type} ${item.listing_id}`}</p>
                <p className="text-muted">{formatDate(item.created_at)}</p>
                <pre className="mt-1 max-w-3xl overflow-x-auto whitespace-pre-wrap text-xs text-muted">{JSON.stringify(item.payload, null, 2)}</pre>
              </div>
              <ResolveButton id={item.id} />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Top searches (30d)</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm">
          {topSearches.map((t) => <li key={t.q}>{t.q || "(any)"} — {t.n}</li>)}
        </ol>
      </section>
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted">Changes apply within 30 seconds, no redeploy needed.</p>
        {entries.map(([label, key, value]) => <ConfigEditor key={key} label={label} configKey={key} initial={value} />)}
      </section>
    </div>
  );
}
