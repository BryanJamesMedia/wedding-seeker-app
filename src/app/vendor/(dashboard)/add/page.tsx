import type { Metadata } from "next";
import { categoryLabel } from "@/lib/categories";
import { MAX_PENDING_REQUESTS, countPendingRequests } from "@/lib/listing-requests";
import { listCategories } from "@/lib/search";
import { US_STATES } from "@/lib/us-states";
import { requireVendor } from "@/lib/vendor-auth";
import { AddListingForm } from "./form";

export const metadata: Metadata = { title: "Add your listing" };

export default async function AddListingPage() {
  const user = await requireVendor("/vendor/add");
  const [categories, pending] = await Promise.all([listCategories(), countPendingRequests(user.id)]);
  const vendorCategories = categories
    .filter((c) => c.listingType === "vendor")
    .map((c) => ({ value: c.category, label: categoryLabel(c.category) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Add your listing</h1>
        <p className="mt-1 text-sm text-muted">
          Can&apos;t find your venue or business to claim? Send us its basic details. We review every new listing, and once
          it&apos;s approved it goes live on Wedding Seeker and you&apos;ll own it.
        </p>
      </div>
      {pending >= MAX_PENDING_REQUESTS ? (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted">
          You have {MAX_PENDING_REQUESTS} listings awaiting approval. You can add more once we&apos;ve reviewed them.
        </p>
      ) : (
        <AddListingForm categories={vendorCategories} states={US_STATES} defaultEmail={user.email} />
      )}
    </div>
  );
}
