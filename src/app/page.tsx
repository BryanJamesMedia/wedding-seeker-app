import { SearchPanel } from "@/components/search-panel";
import { getConfig } from "@/lib/config";
import { countListings, listCategories } from "@/lib/search";

export const revalidate = 300;

export default async function Home() {
  const [config, categories, counts] = await Promise.all([getConfig(), listCategories(), countListings()]);
  return (
    <>
      <section className="bg-gradient-to-b from-accent-soft/60 to-background">
        <div className="mx-auto max-w-3xl px-4 pb-12 pt-10 sm:pt-16">
          <h1 className="text-center font-serif text-4xl font-semibold leading-tight sm:text-6xl">
            Describe your dream wedding.
            <br />
            <span className="text-accent">We&apos;ll find it.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted">
            Search {counts.total.toLocaleString()} venues and vendors in plain English and get them ranked by how well they
            fit the wedding you have in mind.
          </p>
          <div className="mt-8">
            <SearchPanel
              categories={categories}
              filters={config.filters}
              initial={{ categories: [], location: "", radius: 25, description: "", filters: {} }}
            />
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:grid-cols-3">
        {[
          ["Say it your way", "“Laid-back beach ceremony, sunset, about 60 guests.” Our search understands vibe, not just keywords."],
          ["Every option, ranked", "Every listing that fits your filters is included, with the closest matches to your description first."],
          ["Connect in one click", "Send your wedding details to vendors and track every reply in one dashboard."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-serif text-2xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>
    </>
  );
}
