import Link from "next/link";
import { query } from "@/db";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { DeleteSearchButton } from "./delete-button";

export default async function SavedSearchesPage() {
  const user = await requireUser("/dashboard/searches");
  const rows = await query<{ id: string; name: string; query: { qs?: string }; weekly_alert: boolean; created_at: string }>(
    "SELECT id, name, query, weekly_alert, created_at FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC",
    [user.id],
  );
  return (
    <div>
      <h1 className="font-serif text-4xl font-semibold">Saved searches</h1>
      {rows.length === 0 ? (
        <p className="mt-4 text-muted">No saved searches yet. Run a search and choose “Save search”.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/search?${r.query.qs ?? ""}`} className="font-medium hover:underline">{r.name}</Link>
                <p className="text-sm text-muted">Saved {formatDate(r.created_at)}</p>
              </div>
              <DeleteSearchButton id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
