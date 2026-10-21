import { notFound } from "next/navigation";
import { isListingType } from "@/lib/saves";
import { EDITABLE_FIELDS, getEditableListing, ownsListing } from "@/lib/vendor";
import { requireVendor } from "@/lib/vendor-auth";
import { EditListingForm } from "./form";

export default async function EditListingPage({ params }: PageProps<"/vendor/listings/[type]/[id]">) {
  const { type, id } = await params;
  const user = await requireVendor(`/vendor/listings/${type}/${id}`);
  if (!isListingType(type)) notFound();
  const ref = { listingType: type, listingId: id };
  if (!(await ownsListing(user.id, ref))) notFound();
  const listing = await getEditableListing(ref);
  if (!listing) notFound();
  const values: Record<string, string> = {};
  for (const f of EDITABLE_FIELDS) {
    const v = listing[f.key];
    values[f.key] = Array.isArray(v) ? v.join("\n") : v == null ? "" : String(v);
  }
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{listing.name}</h1>
        <p className="mt-1 text-sm text-muted">Changes show on your public listing right away. Photo uploads are coming soon.</p>
      </div>
      <EditListingForm
        listingType={type}
        listingId={id}
        fields={EDITABLE_FIELDS.map((f) => ({ key: f.key, label: f.label, kind: f.kind, group: f.group }))}
        values={values}
        fallbackEmail={listing.email_1}
      />
    </div>
  );
}
