import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { listClaims } from "@/lib/vendor";
import { requireVendor } from "@/lib/vendor-auth";

export default async function VendorListingsPage() {
  const user = await requireVendor("/vendor/listings");
  const claims = await listClaims(user.id);
  const approved = claims.filter((c) => c.status === "approved");
  const pending = claims.filter((c) => c.status === "pending");
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold">Edit your listing</h1>
      {approved.length ? (
        <ul className="divide-y divide-border rounded-3xl border border-border bg-card px-4">
          {approved.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-muted">· {c.listing_type === "venue" ? "Venue" : categoryLabel(c.category ?? "")} · {[c.city, c.state].filter(Boolean).join(", ")}</span>
              </span>
              <Link href={`/vendor/listings/${c.listing_type}/${c.listing_id}`} className="rounded-full border border-accent px-4 py-1.5 font-medium text-accent hover:bg-accent-soft">Edit</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted">
          {pending.length
            ? "Your claim is awaiting approval. You can edit your listing here once it's approved."
            : <>You don&apos;t have an approved listing yet. <Link href="/vendor/claim" className="text-accent underline">Claim your listing</Link> first.</>}
        </p>
      )}
    </div>
  );
}
