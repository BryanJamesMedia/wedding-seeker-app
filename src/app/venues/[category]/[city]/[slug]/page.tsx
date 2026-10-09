import { ListingPage, listingMetadata } from "@/components/detail/listing-page";

export async function generateMetadata({ params }: PageProps<"/venues/[category]/[city]/[slug]">) {
  return listingMetadata("venue", params);
}

export default function Page({ params, searchParams }: PageProps<"/venues/[category]/[city]/[slug]">) {
  return <ListingPage type="venue" params={params} searchParams={searchParams} />;
}
