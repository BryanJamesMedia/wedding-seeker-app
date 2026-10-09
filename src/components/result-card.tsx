import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { isLocked } from "@/lib/gating";
import type { SearchResult } from "@/lib/search";
import { ListingActions, type ActionViewer } from "./listing-actions";
import { LockedValue } from "./locked";

export function ResultCard({
  result,
  viewer,
  saved,
  connectionStatus,
}: {
  result: SearchResult;
  viewer: ActionViewer;
  saved: boolean;
  connectionStatus: string | null;
}) {
  return (
    <article className="flex gap-4 rounded-2xl border border-border bg-card p-3 sm:p-4">
      <Link href={result.href} className="shrink-0" tabIndex={-1} aria-hidden>
        {result.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.thumbnail} alt="" loading="lazy" className="size-24 rounded-xl object-cover sm:h-32 sm:w-44" />
        ) : (
          <div className="size-24 rounded-xl bg-accent-soft sm:h-32 sm:w-44" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {result.matchLabel ? (
            <span className="rounded-full bg-[#e7f3ee] px-2 py-0.5 text-xs font-medium text-sage">{result.matchLabel}</span>
          ) : null}
          <span className="text-xs uppercase tracking-wide text-muted">{result.category}</span>
        </div>
        <h3 className="mt-1 font-serif text-xl font-semibold leading-tight">
          <Link href={result.href} className="hover:text-accent">
            {result.name}
          </Link>
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {[result.city, result.state].filter(Boolean).join(", ")}
            {result.distanceMiles != null ? ` · ${result.distanceMiles} mi` : ""}
          </span>
          {result.rating != null ? (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-gold text-gold" aria-hidden />
              {result.rating.toFixed(1)}
              {result.reviewCount ? <span>({result.reviewCount})</span> : null}
            </span>
          ) : null}
        </p>
        {result.summary ? <p className="mt-1.5 line-clamp-2 text-sm">{result.summary}</p> : null}
        <p className="mt-1.5 text-sm">
          {isLocked(result.phone) ? <LockedValue label="Phone available with Plus" /> : result.phone}
        </p>
        <div className="mt-3">
          <ListingActions
            viewer={viewer}
            listingType={result.listingType}
            listingId={result.listingId}
            name={result.name}
            saved={saved}
            connectionStatus={connectionStatus}
          />
        </div>
      </div>
    </article>
  );
}
