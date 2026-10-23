import { query } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/utils";
import { ResolveButton } from "../client";

export const metadata = { title: "Inbox · Admin" };

export default async function InboxPage() {
  await requireAdmin();
  const inbox = await query<{ id: string; kind: string; listing_type: string | null; listing_id: string | null; payload: Record<string, unknown>; created_at: string; name: string | null }>(
    `SELECT a.*, l.name FROM admin_inbox a
     LEFT JOIN listings l ON l.listing_type = a.listing_type AND l.listing_id::text = a.listing_id
     WHERE a.resolved_at IS NULL ORDER BY a.created_at DESC LIMIT 100`,
  );
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Inbox ({inbox.length})</h1>
      <p className="text-sm text-muted">Connect requests for vendors with no email on file, plus reports. Contact the vendor manually, then resolve.</p>
      <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
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
    </>
  );
}
