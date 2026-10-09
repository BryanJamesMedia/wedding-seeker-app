import Link from "next/link";
import { query } from "@/db";
import { requireUser } from "@/lib/session";
import { listingHref } from "@/lib/search";
import { STATUS_LABELS } from "@/lib/connections";
import { formatDate } from "@/lib/utils";

const TONE: Record<string, string> = {
  responded_interested: "bg-[#eef2ef] text-sage",
  responded_unavailable: "bg-border text-muted",
  bounced: "bg-red-50 text-red-700",
};

export default async function ConnectionsPage() {
  const user = await requireUser("/dashboard/connections");
  const rows = await query<{ id: string; listing_type: string; slug: string; name: string; category: string | null; city: string | null; state: string | null; status: string; created_at: Date; responded_at: Date | null; events: { type: string; at: string }[] }>(
    `SELECT c.id, l.listing_type, l.slug, l.name, l.category, l.city, l.state, c.status, c.created_at, c.responded_at,
       coalesce((SELECT json_agg(json_build_object('type', e.type, 'at', e.created_at) ORDER BY e.created_at) FROM connection_events e WHERE e.request_id = c.id), '[]') AS events
     FROM connection_requests c JOIN listings l ON l.listing_type = c.listing_type AND l.listing_id = c.listing_id
     WHERE c.user_id = $1 ORDER BY c.created_at DESC`,
    [user.id],
  );
  return (
    <div>
      <h1 className="font-serif text-4xl font-semibold">Connections</h1>
      {rows.length === 0 ? (
        <p className="mt-4 text-muted">You haven&apos;t sent any Connect requests yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={listingHref(r)} className="font-medium hover:text-accent">{r.name}</Link>
                  <p className="text-sm text-muted">{r.category} · {[r.city, r.state].filter(Boolean).join(", ")}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${TONE[r.status] ?? "bg-accent-soft text-accent"}`}>{STATUS_LABELS[r.status]}</span>
              </div>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-muted">History</summary>
                <ol className="mt-2 space-y-1">
                  {r.events.map((e, i) => (
                    <li key={i} className="flex justify-between text-muted"><span>{STATUS_LABELS[e.type] ?? e.type}</span><span>{formatDate(e.at)}</span></li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
