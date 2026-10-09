import type { Metadata } from "next";
import Link from "next/link";
import { SearchPanel } from "@/components/search-panel";
import { ResultCard } from "@/components/result-card";
import { getConfig } from "@/lib/config";
import { getViewer } from "@/lib/session";
import { getUserStates } from "@/lib/saves";
import { listCategories, parseSearchParams, searchListings, SORT_OPTIONS, toQueryString } from "@/lib/search";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

const SORT_LABELS = { best: "Best match", distance: "Distance", rating: "Rating" } as const;

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = await searchParams;
  const params = parseSearchParams(raw);
  const [viewer, config, categories] = await Promise.all([getViewer(), getConfig(), listCategories()]);
  const ready = params.categories.length > 0 && params.location;
  const response = ready ? await searchListings(params, viewer) : null;
  const states =
    response && viewer.userId
      ? await getUserStates(viewer.userId, response.results.map((r) => ({ listingType: r.listingType, listingId: r.listingId })))
      : new Map();
  const actionViewer = viewer.paid ? "paid" : viewer.userId ? "unpaid" : "anonymous";

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[340px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <SearchPanel
          compact
          categories={categories}
          filters={config.filters}
          initial={{
            categories: params.categories,
            location: params.location,
            radius: params.radius,
            description: params.description,
            filters: params.filters,
          }}
        />
      </aside>

      <section aria-labelledby="results-heading" aria-live="polite">
        {!response ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
            <h1 id="results-heading" className="font-serif text-3xl text-foreground">Start your search</h1>
            <p className="mt-2">Pick what you&apos;re looking for and where, then describe your wedding in your own words.</p>
          </div>
        ) : response.error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 id="results-heading" className="font-medium">{response.error}</h1>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 id="results-heading" className="font-serif text-3xl font-semibold">
                  {response.total} {response.total === 1 ? "match" : "matches"}
                  {response.location ? <span className="text-muted"> near {response.location.label}</span> : null}
                </h1>
                {response.usedDescription && response.topMatches > 0 ? (
                  <p className="text-sm text-muted">{response.topMatches} top matches for your description</p>
                ) : null}
              </div>
              <nav aria-label="Sort results" className="flex gap-1 text-sm">
                {SORT_OPTIONS.filter((s) => s !== "best" || response.usedDescription).map((s) => (
                  <Link
                    key={s}
                    href={`/search?${toQueryString({ ...params, sort: s })}`}
                    aria-current={response.sort === s ? "true" : undefined}
                    className={`rounded-full px-3 py-1.5 ${response.sort === s ? "bg-foreground text-white" : "border border-border bg-white"}`}
                  >
                    {SORT_LABELS[s]}
                  </Link>
                ))}
              </nav>
            </div>

            {response.results.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
                <p className="font-medium">No listings match those filters.</p>
                {response.zeroResultHint ? (
                  <Link href={response.zeroResultHint.href} className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-white">
                    {response.zeroResultHint.label}
                  </Link>
                ) : null}
              </div>
            ) : (
              <ol className="mt-4 space-y-3">
                {response.results.map((r) => {
                  const state = states.get(`${r.listingType}:${r.listingId}`);
                  return (
                    <li key={`${r.listingType}:${r.listingId}`}>
                      <ResultCard result={r} viewer={actionViewer} saved={state?.saved ?? false} connectionStatus={state?.connection?.status ?? null} />
                    </li>
                  );
                })}
              </ol>
            )}

            {response.lockedCount > 0 ? (
              <div className="mt-4 rounded-2xl border border-gold/40 bg-[#fbf1df] p-6 text-center">
                <p className="font-serif text-2xl font-semibold">+{response.lockedCount} more matches</p>
                <p className="mt-1 text-sm text-muted">Wedding Seeker Plus shows every match, plus contact details, Save and Connect.</p>
                <Link
                  href={viewer.userId ? `/upgrade?return=${encodeURIComponent(`/search?${toQueryString(params)}`)}` : `/search?${toQueryString(params)}&signup=1`}
                  className="mt-3 inline-block rounded-full bg-accent px-5 py-2.5 font-medium text-white"
                >
                  {viewer.userId ? "Upgrade to see all" : "Sign up to see all"}
                </Link>
              </div>
            ) : null}

            {response.hasMore ? (
              <div className="mt-4 text-center">
                <Link
                  href={`/search?${toQueryString(params)}&page=${params.page + 1}`}
                  className="inline-block rounded-full border border-border bg-white px-5 py-2"
                >
                  Show more
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
