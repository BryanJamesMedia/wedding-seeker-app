import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { countLeads, getBalance } from "@/lib/leads";
import { formatMoney } from "@/lib/utils";
import { listClaims } from "@/lib/vendor";
import { requireVendor } from "@/lib/vendor-auth";

const STATUS: Record<string, string> = { pending: "Awaiting approval", approved: "Approved", rejected: "Not approved" };

export default async function VendorOverview() {
  const user = await requireVendor("/vendor");
  const [claims, counts, balance] = await Promise.all([listClaims(user.id), countLeads(user.id), getBalance(user.id)]);
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold">Welcome{user.name ? `, ${user.name}` : ""}</h1>
      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        {([
          ["/vendor/requests", String(counts.open), "New connection requests"],
          ["/vendor/leads", String(counts.purchased), "Your leads"],
          [null, formatMoney(balance), "Wallet balance"],
        ] as const).map(([href, value, label]) => {
          const body = (
            <>
              <p className="text-2xl font-semibold">{value}</p>
              <p className="text-sm text-muted">{label}</p>
            </>
          );
          return href ? (
            <Link key={label} href={href} className="rounded-2xl border border-border bg-card p-4 hover:border-accent">{body}</Link>
          ) : (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">{body}</div>
          );
        })}
      </section>
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Your listings</h2>
        {claims.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            You haven&apos;t claimed a listing yet. <Link href="/vendor/claim" className="text-accent underline">Find and claim your listing</Link> to start getting connection requests from couples.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-medium">{c.name ?? "Listing"}</span>{" "}
                  <span className="text-muted">· {c.listing_type === "venue" ? "Venue" : categoryLabel(c.category ?? "")} · {[c.city, c.state].filter(Boolean).join(", ")}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs ${c.status === "approved" ? "bg-accent-soft text-accent" : "bg-black/5 text-muted"}`}>{STATUS[c.status]}</span>
                  {c.status === "approved" ? (
                    <Link href={`/vendor/listings/${c.listing_type}/${c.listing_id}`} className="text-accent underline">Edit</Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {claims.some((c) => c.status === "pending") ? (
          <p className="mt-3 text-xs text-muted">We review every claim by hand, usually within 1–2 business days. You can edit a listing once its claim is approved.</p>
        ) : null}
      </section>
    </div>
  );
}
