import Link from "next/link";
import { query } from "@/db";
import { categoryLabel } from "@/lib/categories";
import { requireVendor } from "@/lib/vendor-auth";

type Row = { listing_type: "venue" | "vendor"; listing_id: string; name: string; category: string | null; city: string | null; state: string | null; mine: string | null; taken: boolean };

export default async function ClaimSearchPage({ searchParams }: PageProps<"/vendor/claim">) {
  const user = await requireVendor("/vendor/claim");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const where = typeof params.where === "string" ? params.where.trim().slice(0, 100) : "";
  const rows = q
    ? await query<Row>(
        `SELECT l.listing_type, l.listing_id, l.name, l.category, l.city, l.state,
           (SELECT c.status FROM listing_claims c WHERE c.user_id = $3 AND c.listing_type = l.listing_type AND c.listing_id = l.listing_id) AS mine,
           EXISTS (SELECT 1 FROM listing_claims c WHERE c.listing_type = l.listing_type AND c.listing_id = l.listing_id AND c.status = 'approved' AND c.user_id <> $3) AS taken
         FROM listings l
         WHERE l.status = 'active' AND l.name ILIKE '%' || $1 || '%'
           AND ($2 = '' OR l.city ILIKE $2 || '%' OR l.zip LIKE $2 || '%' OR l.state ILIKE $2)
         ORDER BY (lower(l.name) = lower($1)) DESC, l.name LIMIT 30`,
        [q, where, user.id],
      )
    : [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Claim your listing</h1>
        <p className="mt-1 text-sm text-muted">Search for your venue or business by name, then claim it.</p>
      </div>
      <form className="flex flex-wrap gap-2 rounded-3xl border border-border bg-card p-4">
        <input name="q" defaultValue={q} required placeholder="Business name" aria-label="Business name" className="min-w-0 flex-1 rounded-full border border-border px-4 py-2" />
        <input name="where" defaultValue={where} placeholder="City or ZIP (optional)" aria-label="City or ZIP" className="w-48 rounded-full border border-border px-4 py-2" />
        <button className="rounded-full bg-foreground px-5 py-2 text-white">Search</button>
      </form>
      {q ? (
        rows.length ? (
          <ul className="divide-y divide-border rounded-3xl border border-border bg-card px-4">
            {rows.map((r) => (
              <li key={`${r.listing_type}:${r.listing_id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-medium">{r.name}</span>{" "}
                  <span className="text-muted">· {r.listing_type === "venue" ? "Venue" : categoryLabel(r.category ?? "")} · {[r.city, r.state].filter(Boolean).join(", ")}</span>
                </span>
                {r.mine === "approved" ? (
                  <Link href={`/vendor/listings/${r.listing_type}/${r.listing_id}`} className="text-accent underline">Yours: edit</Link>
                ) : r.mine === "pending" ? (
                  <span className="text-muted">Claim awaiting approval</span>
                ) : r.taken ? (
                  <span className="text-muted">Already claimed</span>
                ) : (
                  <Link href={`/vendor/claim/${r.listing_type}/${r.listing_id}`} className="rounded-full border border-accent px-4 py-1.5 font-medium text-accent hover:bg-accent-soft">Claim</Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No listings found. Try a shorter name, or leave out the city.</p>
        )
      ) : null}
    </div>
  );
}
