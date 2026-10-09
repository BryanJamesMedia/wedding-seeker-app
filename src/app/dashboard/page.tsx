import Link from "next/link";
import { query } from "@/db";
import { requireUser, isPaid } from "@/lib/session";
import { STATUS_LABELS } from "@/lib/connections";
import { formatDate } from "@/lib/utils";
import { UpgradeButton } from "@/components/upgrade-button";

export default async function DashboardHome() {
  const user = await requireUser();
  const paid = isPaid(user);
  const [counts] = await query<{ saved: string; connections: string; replies: string }>(
    `SELECT (SELECT count(*) FROM saved_listings WHERE user_id = $1) AS saved,
            (SELECT count(*) FROM connection_requests WHERE user_id = $1) AS connections,
            (SELECT count(*) FROM connection_requests WHERE user_id = $1 AND status LIKE 'responded%') AS replies`,
    [user.id],
  );
  const recent = await query<{ name: string; status: string; updated_at: Date }>(
    `SELECT l.name, c.status, c.updated_at FROM connection_requests c
     JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
     WHERE c.user_id = $1 ORDER BY c.updated_at DESC LIMIT 5`,
    [user.id],
  );
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl font-semibold">Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
      {!paid ? (
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-6">
          <h2 className="font-serif text-2xl font-semibold">Unlock Saved and Connect</h2>
          <p className="mt-1 text-sm text-muted">Upgrade to see contact details, save favorites, and send your wedding details to vendors in one click.</p>
          <div className="mt-4 max-w-xs"><UpgradeButton continueUrl="/auth/continue?return=%2Fdashboard" /></div>
        </div>
      ) : null}
      <dl className="grid grid-cols-3 gap-3">
        {[["Saved", counts.saved, "/dashboard/saved"], ["Connect requests", counts.connections, "/dashboard/connections"], ["Replies", counts.replies, "/dashboard/connections"]].map(([label, n, href]) => (
          <Link key={label} href={href} className="rounded-2xl border border-border bg-card p-4 hover:border-accent">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-serif text-3xl font-semibold">{n}</dd>
          </Link>
        ))}
      </dl>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-muted">No activity yet. <Link href="/search" className="text-accent underline">Start searching</Link>.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
            {recent.map((r) => (
              <li key={`${r.name}${r.updated_at}`} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted">{STATUS_LABELS[r.status]} · {formatDate(r.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
