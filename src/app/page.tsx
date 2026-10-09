import { SearchPanel } from "@/components/search-panel";
import { getConfig } from "@/lib/config";
import { countListings, listCategories } from "@/lib/search";

export const revalidate = 300;

export default async function Home() {
  const [config, categories, counts] = await Promise.all([getConfig(), listCategories(), countListings()]);
  return (
    <>
      <section className="bg-hero">
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-12 sm:pb-24 sm:pt-20">
          <h1 className="text-center font-serif text-4xl font-bold leading-tight text-white sm:text-6xl">
            Describe your dream wedding.
            <br />
            We&apos;ll find it.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-center text-lg font-light text-white/85 sm:text-xl">
            Search {counts.total.toLocaleString()} venues and vendors in plain English and get them ranked by how well they
            fit the wedding you have in mind.
          </p>
          <div className="mt-8 text-foreground">
            <SearchPanel
              categories={categories}
              filters={config.filters}
              initial={{ categories: [], location: "", radius: 25, description: "", filters: {} }}
            />
          </div>
        </div>
      </section>
      <section className="bg-accent-soft px-4 py-14 text-center">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">Wedding planning shouldn&apos;t feel like a second job.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted">
          Skip the endless listing sites. Tell us what you want once and see every venue and vendor that fits, best matches first.
        </p>
        <div className="mx-auto mt-6 h-0.5 w-12 bg-accent" aria-hidden />
      </section>
      <section className="bg-floral">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-16 sm:grid-cols-3">
          {[
            ["Say it your way", "“Laid-back beach ceremony, sunset, about 60 guests.” Our search understands vibe, not just keywords."],
            ["Every option, ranked", "Every listing that fits your filters is included, with the closest matches to your description first."],
            ["Connect in one click", "Send your wedding details to vendors and track every reply in one dashboard."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm">
              <h2 className="font-serif text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
