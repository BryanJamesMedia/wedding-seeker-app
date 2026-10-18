/* eslint-disable @next/next/no-img-element -- post images can be hosted anywhere */
import type { Metadata } from "next";
import Link from "next/link";
import { formatPostDate, listCategories, listPosts } from "@/lib/blog";
import { POST_IMAGE_FALLBACK, PostCard } from "@/components/blog/post-card";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Wedding Planning Blog",
  description: "Wedding planning guides, venue and vendor advice, budgets and checklists from Wedding Seeker.",
  alternates: { canonical: "/blog" },
};

export default async function BlogIndex({ searchParams }: PageProps<"/blog">) {
  const raw = (await searchParams).category;
  const category = typeof raw === "string" && raw ? raw : undefined;
  const [posts, categories] = await Promise.all([listPosts({ category }), listCategories()]);
  const lead = category ? null : (posts.find((p) => p.featured) ?? posts[0] ?? null);
  const rest = posts.filter((p) => p !== lead);

  return (
    <>
      <section className="bg-hero px-4 py-16 text-center text-white sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-coral">Wedding Planning Tips</p>
        <h1 className="mt-3 font-serif text-4xl font-bold sm:text-5xl">The Wedding Seeker Blog</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg font-light text-white/85">
          Expert advice, planning guides and inspiration to help you through every step of your wedding journey.
        </p>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {categories.length > 1 ? (
          <nav aria-label="Blog categories" className="mb-10 flex flex-wrap justify-center gap-2">
            {[undefined, ...categories].map((c) => {
              const active = (c ?? null) === (category ?? null) || (c && category && c.toLowerCase() === category.toLowerCase());
              return (
                <Link key={c ?? "all"} href={c ? `/blog?category=${encodeURIComponent(c)}` : "/blog"} aria-current={active ? "page" : undefined}
                  className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", active ? "border-navy bg-navy text-white" : "border-border bg-white hover:border-accent hover:text-accent")}>
                  {c ?? "All posts"}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">No posts yet. Check back soon!</p>
        ) : null}

        {lead ? (
          <Link href={`/blog/${lead.slug}`} className="group mb-12 grid overflow-hidden rounded-2xl border border-border bg-white shadow-sm md:grid-cols-2">
            <div className="aspect-[16/10] overflow-hidden md:aspect-auto md:h-full">
              <img src={lead.featuredImage || POST_IMAGE_FALLBACK} alt={lead.featuredImageAlt || lead.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-coral">Featured{lead.category ? ` · ${lead.category}` : ""}</p>
              <h2 className="mt-3 font-serif text-3xl font-bold leading-tight group-hover:text-accent">{lead.title}</h2>
              <p className="mt-3 text-sm text-muted">{formatPostDate(lead.publishedAt)} · {lead.readMinutes} min read</p>
              {lead.excerpt ? <p className="mt-4 leading-relaxed text-foreground/80">{lead.excerpt}</p> : null}
              <span className="mt-6 font-semibold text-accent">Read the article →</span>
            </div>
          </Link>
        ) : null}

        {rest.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => <PostCard key={post.slug} post={post} />)}
          </div>
        ) : null}
      </div>
    </>
  );
}
