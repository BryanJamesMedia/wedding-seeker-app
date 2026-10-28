import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { LISTING_STATUSES, getAdminListing, searchAdminListings } from "@/lib/admin-listings";
import { categoryLabel } from "@/lib/categories";
import { isListingType } from "@/lib/saves";
import { listCategories, listingHref } from "@/lib/search";
import { EDITABLE_FIELDS } from "@/lib/vendor";
import { EditListingForm } from "@/app/vendor/(dashboard)/listings/[type]/[id]/form";
import { DeleteListingButton } from "../../delete-button";

export const metadata = { title: "Edit listing · Admin" };

const STATUS_LABELS: Record<string, string> = {
  active: "Active (live on the site)",
  hidden: "Hidden (not shown anywhere)",
  pending: "Pending (awaiting approval)",
  closed: "Closed (business closed)",
};

export default async function AdminEditListingPage({ params }: PageProps<"/admin/listings/[type]/[id]">) {
  await requireAdmin();
  const { type, id } = await params;
  if (!isListingType(type)) notFound();
  const listing = await getAdminListing({ listingType: type, listingId: id });
  if (!listing) notFound();

  const categories = type === "vendor" ? (await listCategories()).filter((c) => c.listingType === "vendor").map((c) => c.category) : [];
  const current = listing.category?.trim().toLowerCase() ?? "";
  if (type === "vendor" && current && !categories.includes(current)) categories.unshift(current);
  const basics = [
    { key: "name", label: "Name", kind: "text", group: "Basics" },
    ...(type === "vendor"
      ? [{ key: "category", label: "Category", kind: "select", group: "Basics", options: [{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c, label: categoryLabel(c) }))] }]
      : []),
    { key: "status", label: "Status", kind: "select", group: "Basics", options: LISTING_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })) },
  ];
  const values: Record<string, string> = { name: listing.name, category: current, status: listing.status };
  for (const f of EDITABLE_FIELDS) {
    const v = listing[f.key];
    values[f.key] = Array.isArray(v) ? v.join("\n") : v == null ? "" : String(v);
  }
  const [impact] = (await searchAdminListings(listing.name)).filter((r) => r.listing_type === type && r.listing_id === id);
  const place = [listing.city, listing.state].filter(Boolean).join(", ");
  const href =
    listing.status === "active" && listing.slug
      ? listingHref({ listing_type: type, category: listing.category, city: listing.city as string | null, state: listing.state as string | null, slug: String(listing.slug) })
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/admin/listings?q=${encodeURIComponent(listing.name)}`} className="text-sm text-accent hover:underline">← Listings</Link>
        <h1 className="mt-2 font-serif text-3xl font-semibold">{listing.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {[type === "venue" ? "Venue" : current ? categoryLabel(current) : "Vendor", place].filter(Boolean).join(" · ")}
          {href ? (
            <>
              {" · "}
              <a href={href} target="_blank" rel="noreferrer" className="text-accent underline">View public page</a>
            </>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-muted">Changes go live right away. Renaming gives the listing a new URL, and the old one redirects to it.</p>
      </div>
      <EditListingForm
        listingType={type}
        listingId={id}
        endpoint="/api/admin/listings"
        fields={[...basics, ...EDITABLE_FIELDS.map((f) => ({ key: f.key, label: f.label, kind: f.kind, group: f.group }))]}
        values={values}
        fallbackEmail={listing.email_1}
      />
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-red-200 bg-card p-6">
        <div>
          <h2 className="font-semibold">Delete listing</h2>
          <p className="text-sm text-muted">Spam or a duplicate? Delete it permanently.</p>
        </div>
        <DeleteListingButton
          listingType={type}
          listingId={id}
          name={listing.name}
          place={place}
          after="/admin/listings"
          impact={{
            photos: impact?.photos ?? 0,
            claims: impact?.claims ?? 0,
            saves: impact?.saves ?? 0,
            connections: impact?.connections ?? 0,
            purchased: impact?.purchased ?? 0,
            owner: impact?.owner_email ?? null,
          }}
        />
      </section>
    </div>
  );
}
