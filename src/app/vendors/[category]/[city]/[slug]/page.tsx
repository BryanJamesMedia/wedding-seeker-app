import { ListingPage, listingMetadata } from "@/components/detail/listing-page";

export async function generateMetadata({ params }: PageProps<"/vendors/[category]/[city]/[slug]">) {
  return listingMetadata("vendor", params);
}

export default function Page({ params, searchParams }: PageProps<"/vendors/[category]/[city]/[slug]">) {
  return <ListingPage type="vendor" params={params} searchParams={searchParams} />;
}
