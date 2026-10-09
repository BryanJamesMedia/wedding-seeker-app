import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Globe, MapPin, Phone, Star } from "lucide-react";
import { getListingDetail, similarListings, type ListingDetail } from "@/lib/listing";
import { isLocked } from "@/lib/gating";
import { getViewer } from "@/lib/session";
import { getUserStates } from "@/lib/saves";
import { APP_URL } from "@/lib/urls";
import { ListingActions } from "@/components/listing-actions";
import { LockedValue } from "@/components/locked";

type Params = Promise<{ category: string; city: string; slug: string }>;

function str(value: unknown): string | null {
  if (value == null || isLocked(value)) return null;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  if (typeof value === "object") return null;
  return String(value);
}

export async function listingMetadata(type: "venue" | "vendor", params: Params): Promise<Metadata> {
  const { slug } = await params;
  const { listing } = await getListingDetail(type, slug, { userId: null, paid: false });
  if (!listing) return { title: "Not found" };
  const place = [listing.city, listing.state].filter(Boolean).join(", ");
  const title = `${listing.name} — ${str(listing.category) ?? "Wedding"} in ${place}`;
  const description = (str(listing.summary) ?? `${listing.name} is a wedding ${type} in ${place}.`).slice(0, 160);
  const image = listing.photos[0];
  return {
    title,
    description,
    alternates: { canonical: listing.href },
    openGraph: { title, description, url: listing.href, images: image ? [image] : undefined },
  };
}

function jsonLd(listing: ListingDetail, type: "venue" | "vendor") {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type === "venue" ? "EventVenue" : "LocalBusiness",
    name: listing.name,
    url: `${APP_URL}${listing.href}`,
    description: str(listing.summary) ?? undefined,
    image: listing.photos[0] ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: str(listing.city) ?? undefined,
      addressRegion: str(listing.state) ?? undefined,
    },
  };
  const score = str(listing.review_score);
  const count = str(listing.review_count);
  if (listing.showRating && score && count && Number(count) > 0) {
    data.aggregateRating = { "@type": "AggregateRating", ratingValue: Number(score), reviewCount: Number(count) };
  }
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const SECTIONS: { title: string; fields: [string, string][] }[] = [
  {
    title: "Details",
    fields: [
      ["venue_type", "Venue type"],
      ["indoor_outdoor", "Indoor / outdoor"],
      ["private_public", "Private / public"],
      ["capacity_notes", "Capacity"],
      ["price_notes", "Pricing"],
      ["year_established", "Established"],
    ],
  },
  {
    title: "Services & amenities",
    fields: [
      ["services", "Services"],
      ["amenities", "Amenities"],
      ["parking", "Parking"],
      ["alcohol_policy", "Alcohol policy"],
      ["catering_policy", "Catering policy"],
      ["accessibility", "Accessibility"],
    ],
  },
  {
    title: "Booking",
    fields: [
      ["hours", "Hours"],
      ["reservation_instructions", "How to book"],
    ],
  },
];

function range(min: unknown, max: unknown, prefix = "") {
  const a = str(min);
  const b = str(max);
  if (!a && !b) return null;
  const f = (v: string) => `${prefix}${Number(v).toLocaleString()}`;
  return a && b ? `${f(a)}–${f(b)}` : a ? `From ${f(a)}` : `Up to ${f(b!)}`;
}

export async function ListingPage({ type, params, searchParams }: { type: "venue" | "vendor"; params: Params; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  const { listing, redirectTo } = await getListingDetail(type, slug, viewer);
  if (redirectTo) permanentRedirect(redirectTo);
  if (!listing) notFound();
  const { city, category } = await params;
  if (city !== listing.citySlug || category !== listing.categorySlug) permanentRedirect(listing.href);

  const [similar, states, sp] = await Promise.all([
    similarListings(type, listing.listingId),
    viewer.userId ? getUserStates(viewer.userId, [{ listingType: type, listingId: listing.listingId }]) : Promise.resolve(new Map()),
    searchParams,
  ]);
  const state = states.get(`${type}:${listing.listingId}`);
  const actionViewer = viewer.paid ? "paid" : viewer.userId ? "unpaid" : "anonymous";
  const back = typeof sp.from === "string" && sp.from.startsWith("/search") ? sp.from : null;

  const contact: { icon: typeof Phone; label: string; value: unknown; href?: (v: string) => string }[] = [
    { icon: Phone, label: "Phone", value: listing.phone_1, href: (v) => `tel:${v.replace(/[^\d+]/g, "")}` },
    { icon: Globe, label: "Website", value: listing.domain, href: (v) => (v.startsWith("http") ? v : `https://${v}`) },
    { icon: MapPin, label: "Address", value: listing.address },
  ];

  const capacity = range(listing.capacity_min, listing.capacity_max);
  const price = range(listing.price_min, listing.price_max, "$");
  const rating = listing.showRating ? str(listing.review_score) : null;

  return (
    <article className="mx-auto max-w-5xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(listing, type) }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        {back ? (
          <Link href={back} className="underline underline-offset-2">← Back to results</Link>
        ) : (
          <Link href={`/search?category=${encodeURIComponent(str(listing.category) ?? "")}&location=${encodeURIComponent([listing.city, listing.state].filter(Boolean).join(", "))}`} className="underline underline-offset-2">
            More {str(listing.category)?.toLowerCase() ?? "listings"} near {str(listing.city)}
          </Link>
        )}
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{str(listing.category)}</p>
          <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">{listing.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-muted">
            <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{[listing.city, listing.state].filter(Boolean).join(", ")}</span>
            {rating ? (
              <span className="inline-flex items-center gap-1"><Star className="size-4 fill-gold text-gold" aria-hidden />{Number(rating).toFixed(1)} ({str(listing.review_count) ?? 0} reviews)</span>
            ) : null}
          </p>
        </div>
        <ListingActions size="lg" viewer={actionViewer} listingType={type} listingId={listing.listingId} name={listing.name} saved={state?.saved ?? false} connectionStatus={state?.connection?.status ?? null} />
      </header>

      <section aria-label="Photos" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {listing.photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={`${listing.name} photo ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} className={`aspect-[4/3] w-full rounded-xl object-cover ${i === 0 ? "col-span-2 row-span-2 aspect-auto h-full" : ""}`} />
        ))}
        {listing.lockedPhotoCount > 0 ? (
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-accent-soft p-3 text-center text-sm text-accent">
            +{listing.lockedPhotoCount} more photos with Plus
          </div>
        ) : null}
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          {str(listing.summary) ? <p className="text-lg">{str(listing.summary)}</p> : null}
          {listing.description != null ? (
            <section>
              <h2 className="font-serif text-2xl font-semibold">About</h2>
              {isLocked(listing.description) ? <LockedValue label="Full description available with Plus" /> : <p className="mt-2 whitespace-pre-line">{str(listing.description)}</p>}
            </section>
          ) : null}
          {(capacity || price) && (
            <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-4">
              {capacity ? <div><dt className="text-xs uppercase text-muted">Guests</dt><dd className="font-medium">{capacity}</dd></div> : null}
              {price ? <div><dt className="text-xs uppercase text-muted">Price</dt><dd className="font-medium">{price}</dd></div> : null}
            </dl>
          )}
          {SECTIONS.map((section) => {
            const rows = section.fields.filter(([key]) => (listing as Record<string, unknown>)[key] != null && !(Array.isArray((listing as Record<string, unknown>)[key]) && ((listing as Record<string, unknown>)[key] as unknown[]).length === 0));
            if (rows.length === 0) return null;
            return (
              <section key={section.title}>
                <h2 className="font-serif text-2xl font-semibold">{section.title}</h2>
                <dl className="mt-2 divide-y divide-border">
                  {rows.map(([key, label]) => {
                    const value = (listing as Record<string, unknown>)[key];
                    return (
                      <div key={key} className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]">
                        <dt className="text-sm text-muted">{label}</dt>
                        <dd className="text-sm">{isLocked(value) ? <LockedValue /> : str(value)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          })}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-serif text-xl font-semibold">Contact</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {contact.map(({ icon: Icon, label, value, href }) =>
                value == null ? null : (
                  <li key={label} className="flex items-start gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                    {isLocked(value) ? (
                      <LockedValue label={`${label} available with Plus`} />
                    ) : href ? (
                      <a href={href(String(value))} className="break-all text-accent underline underline-offset-2" target={label === "Website" ? "_blank" : undefined} rel="noopener nofollow">
                        {String(value)}
                      </a>
                    ) : (
                      <span>{String(value)}</span>
                    )}
                  </li>
                ),
              )}
            </ul>
            {!viewer.paid ? (
              <Link href={viewer.userId ? `/upgrade?return=${encodeURIComponent(listing.href)}` : `${listing.href}?signup=1`} className="mt-3 block rounded-full bg-accent px-4 py-2 text-center text-sm font-medium text-white">
                Unlock contact details
              </Link>
            ) : null}
          </div>
          {listing.mapPoint ? (
            <div className="overflow-hidden rounded-2xl border border-border">
              <iframe
                title={`Map of ${listing.mapPoint.exact ? listing.name : str(listing.city)}`}
                loading="lazy"
                className="h-56 w-full"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.mapPoint.lng - (listing.mapPoint.exact ? 0.01 : 0.08)}%2C${listing.mapPoint.lat - (listing.mapPoint.exact ? 0.01 : 0.06)}%2C${listing.mapPoint.lng + (listing.mapPoint.exact ? 0.01 : 0.08)}%2C${listing.mapPoint.lat + (listing.mapPoint.exact ? 0.01 : 0.06)}${listing.mapPoint.exact ? `&marker=${listing.mapPoint.lat}%2C${listing.mapPoint.lng}` : ""}`}
              />
              {!listing.mapPoint.exact ? <p className="bg-card px-3 py-2 text-xs text-muted">Approximate area. Exact location with Plus.</p> : null}
            </div>
          ) : null}
        </aside>
      </div>

      {similar.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold">Similar {type === "venue" ? "venues" : "vendors"} nearby</h2>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {similar.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="group block">
                  {s.first_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.first_photo} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
                  ) : (
                    <div className="aspect-[4/3] rounded-xl bg-accent-soft" />
                  )}
                  <p className="mt-2 font-medium group-hover:text-accent">{s.name}</p>
                  <p className="text-sm text-muted">{[s.city, s.state].filter(Boolean).join(", ")}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
