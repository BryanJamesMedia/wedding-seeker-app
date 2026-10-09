import Link from "next/link";
import { query } from "@/db";
import { requireUser, isPaid } from "@/lib/session";
import { listingHref } from "@/lib/search";
import { STATUS_LABELS } from "@/lib/connections";
import { ListingActions } from "@/components/listing-actions";

export default async function SavedPage() {
  const user = await requireUser("/dashboard/saved");
  const rows = await query<{ listing_type: "venue" | "vendor"; listing_id: string; slug: string; name: string; category: string | null; city: string | null; state: string | null; first_photo: string | null; status: string | null }>(
    `SELECT l.listing_type, l.listing_id, l.slug, l.name, l.category, l.city, l.state, l.first_photo,
       (SELECT c.status FROM connection_requests c WHERE c.user_id = s.user_id AND c.listing_type = s.listing_type AND c.listing_id = s.listing_id ORDER BY c.created_at DESC LIMIT 1) AS status
     FROM saved_listings s JOIN listings l ON l.listing_type = s.listing_type AND l.listing_id = s.listing_id
     WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
    [user.id],
  );
  const viewer = isPaid(user) ? "paid" : "unpaid";
  return (
    <div>
      <h1 className="font-serif text-4xl font-semibold">Saved</h1>
      {rows.length === 0 ? (
        <p className="mt-4 text-muted">Nothing saved yet. Tap Save on any listing to keep it here.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={`${r.listing_type}:${r.listing_id}`} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
              {r.first_photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.first_photo} alt="" className="size-20 rounded-xl object-cover" />
              ) : <div className="size-20 rounded-xl bg-accent-soft" />}
              <div className="min-w-0 flex-1">
                <Link href={listingHref(r)} className="font-medium hover:text-accent">{r.name}</Link>
                <p className="text-sm text-muted">{r.category} · {[r.city, r.state].filter(Boolean).join(", ")}</p>
                {r.status ? <p className="text-xs text-sage">{STATUS_LABELS[r.status]}</p> : null}
                <div className="mt-2"><ListingActions viewer={viewer} listingType={r.listing_type} listingId={r.listing_id} name={r.name} saved connectionStatus={r.status} /></div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
