import Link from "next/link";
import type { ListingType } from "@/lib/categories";
import { isClaimed } from "@/lib/vendor";

/** "Claim this listing" for unclaimed listings, shown to everyone on the public page. */
export async function ClaimBanner({ listingType, listingId }: { listingType: ListingType; listingId: string }) {
  if (await isClaimed({ listingType, listingId })) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm">
      <span>Is this your business? Claim it to update your details and get connection requests from couples.</span>
      <Link href={`/vendor/claim/${listingType}/${listingId}`} className="rounded-full border border-accent px-4 py-1.5 font-medium text-accent hover:bg-white">
        Claim this listing
      </Link>
    </div>
  );
}
