import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { searchAdminListings } from "@/lib/admin-listings";
import { categoryLabel } from "@/lib/categories";
import { DeleteListingButton } from "./delete-button";

export const metadata = { title: "Listings · Admin" };

const STATUS_STYLE: Record<string, string> = {
  active: "bg-[#e7f3ee] text-sage",
  pending: "bg-accent-soft text-accent-strong",
  hidden: "bg-[#f5f1ec] text-muted",
  closed: "bg-red-50 text-red-700",
};

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 100) : "";
  const rows = q ? await searchAdminListings(q) : [];
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Listings</h1>
      <p className="text-sm text-muted">Find a venue or vendor by name or email to edit or delete it. Every status is included, including hidden and pending listings.</p>
      <form className="flex flex-wrap gap-2 rounded-3xl border border-border bg-card p-4">
        <input name="q" defaultValue={q} required placeholder="Business name or email" aria-label="Business name or email" className="min-w-0 flex-1 rounded-full border border-border px-4 py-2" />
        <button className="rounded-full bg-foreground px-5 py-2 text-white">Search</button>
      </form>
      {q ? (
        rows.length ? (
          <>
            <p className="text-sm text-muted">{rows.length === 50 ? "Showing the first 50 matches. Search for a longer name to narrow it down." : `${rows.length} ${rows.length === 1 ? "match" : "matches"}`}</p>
            <ul className="divide-y divide-border rounded-3xl border border-border bg-card px-4">
              {rows.map((r) => {
                const place = [r.city, r.state].filter(Boolean).join(", ");
                return (
                  <li key={`${r.listing_type}:${r.listing_id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p>
                        <span className="font-medium">{r.name}</span>{" "}
                        <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status] ?? "bg-accent-soft"}`}>{r.status}</span>
                      </p>
                      <p className="text-muted">
                        {[r.listing_type === "venue" ? "Venue" : r.category ? categoryLabel(r.category) : "Vendor", place, r.email].filter(Boolean).join(" · ")}
                      </p>
                      {r.owner_email ? <p className="text-muted">Owner: {r.owner_email}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/listings/${r.listing_type}/${r.listing_id}`}
                        className="rounded-full border border-accent px-4 py-1.5 font-medium text-accent hover:bg-accent-soft"
                      >
                        Edit
                      </Link>
                      <DeleteListingButton
                        listingType={r.listing_type}
                        listingId={r.listing_id}
                        name={r.name}
                        place={place}
                        impact={{ photos: r.photos, claims: r.claims, saves: r.saves, connections: r.connections, purchased: r.purchased, owner: r.owner_email }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">No listings match &quot;{q}&quot;. Try part of the name or email.</p>
        )
      ) : null}
    </>
  );
}
