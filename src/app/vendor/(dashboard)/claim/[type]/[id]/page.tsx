import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne } from "@/db";
import { categoryLabel } from "@/lib/categories";
import { isListingType } from "@/lib/saves";
import { requireVendor } from "@/lib/vendor-auth";
import { ClaimForm } from "./form";

export default async function ClaimListingPage({ params }: PageProps<"/vendor/claim/[type]/[id]">) {
  const { type, id } = await params;
  const user = await requireVendor(`/vendor/claim/${type}/${id}`);
  if (!isListingType(type)) notFound();
  const listing = await queryOne<{ name: string; category: string | null; city: string | null; state: string | null; mine: string | null; taken: boolean }>(
    `SELECT l.name, l.category, l.city, l.state,
       (SELECT c.status FROM listing_claims c WHERE c.user_id = $3 AND c.listing_type = l.listing_type AND c.listing_id = l.listing_id) AS mine,
       EXISTS (SELECT 1 FROM listing_claims c WHERE c.listing_type = l.listing_type AND c.listing_id = l.listing_id AND c.status = 'approved' AND c.user_id <> $3) AS taken
     FROM listings l WHERE l.listing_type = $1 AND l.listing_id = $2 AND l.status = 'active'`,
    [type, id, user.id],
  );
  if (!listing) notFound();
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Claim {listing.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {type === "venue" ? "Venue" : categoryLabel(listing.category ?? "")} · {[listing.city, listing.state].filter(Boolean).join(", ")}
        </p>
      </div>
      {listing.mine === "approved" ? (
        <p className="rounded-2xl bg-accent-soft p-4 text-sm">
          This listing is yours. <Link href={`/vendor/listings/${type}/${id}`} className="text-accent underline">Edit your listing</Link>
        </p>
      ) : listing.mine === "pending" ? (
        <p className="rounded-2xl bg-accent-soft p-4 text-sm">Your claim is awaiting approval. We&apos;ll email you once it&apos;s reviewed.</p>
      ) : listing.taken ? (
        <p className="rounded-2xl bg-accent-soft p-4 text-sm">This listing has already been claimed. If this is your business, please contact support.</p>
      ) : (
        <ClaimForm listingType={type} listingId={id} defaultName={user.name} resubmit={listing.mine === "rejected"} />
      )}
    </div>
  );
}
