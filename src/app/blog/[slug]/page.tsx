/* eslint-disable @next/next/no-img-element -- post images can be hosted anywhere */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Tag } from "lucide-react";
import { formatPostDate, getPost, relatedPosts } from "@/lib/blog";
import { BlogBlocks } from "@/components/blog/blog-blocks";
import { POST_IMAGE_FALLBACK, PostCard } from "@/components/blog/post-card";
import { APP_URL } from "@/lib/urls";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return {};
  const description = post.seoDescription ?? post.excerpt ?? post.subtitle ?? undefined;
  return {
    title: post.seoTitle ?? post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.seoTitle ?? post.title,
      description,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: post.authorName ? [post.authorName] : undefined,
      images: post.featuredImage ? [{ url: post.featuredImage, alt: post.featuredImageAlt ?? post.title }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const related = await relatedPosts(post);
  const image = post.featuredImage || POST_IMAGE_FALLBACK;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    image: new URL(image, APP_URL).toString(),
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@type": "Organization", name: "Wedding Seeker" },
    publisher: { "@type": "Organization", name: "Wedding Seeker" },
    mainEntityOfPage: `${APP_URL}/blog/${post.slug}`,
    keywords: post.tags.length ? post.tags.join(", ") : undefined,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="relative">
        <div className="relative h-[360px] sm:h-[460px]">
          <img src={image} alt={post.featuredImageAlt || post.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/50 via-navy/20 to-background" />
        </div>
        <div className="relative mx-auto -mt-40 max-w-4xl px-4 sm:-mt-48">
          <Link href="/blog" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-white drop-shadow hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Blog
          </Link>
          <div className="rounded-2xl border border-border bg-white p-6 shadow-lg sm:p-10">
            {post.category ? (
              <Link href={`/blog?category=${encodeURIComponent(post.category)}`} className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                <Tag className="h-3.5 w-3.5" aria-hidden /> {post.category}
              </Link>
            ) : null}
            <h1 className="mt-4 font-serif text-3xl font-bold leading-tight sm:text-5xl">{post.title}</h1>
            {post.subtitle ? <p className="mt-4 text-lg leading-relaxed text-muted sm:text-xl">{post.subtitle}</p> : null}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-5 text-sm text-muted">
              {post.authorName ? (
                <div className="flex items-center gap-3">
                  {post.authorImage ? <img src={post.authorImage} alt="" className="h-10 w-10 rounded-full object-cover" /> : null}
                  <div>
                    <p className="font-semibold text-foreground">{post.authorName}</p>
                    {post.authorRole ? <p className="text-xs">{post.authorRole}</p> : null}
                  </div>
                </div>
              ) : null}
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" aria-hidden /> {formatPostDate(post.publishedAt)}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden /> {post.readMinutes} min read</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <BlogBlocks blocks={post.blocks} />

        {post.tags.length > 0 ? (
          <ul aria-label="Tags" className="mt-12 flex flex-wrap gap-2 border-t border-border pt-6">
            {post.tags.map((tag) => <li key={tag} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-navy">#{tag}</li>)}
          </ul>
        ) : null}

        {post.authorName && post.authorBio ? (
          <aside className="mt-10 flex flex-col gap-5 rounded-2xl bg-cream p-6 ring-1 ring-border sm:flex-row sm:items-center sm:p-8">
            {post.authorImage ? <img src={post.authorImage} alt={post.authorName} className="h-20 w-20 shrink-0 rounded-full object-cover" /> : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-coral">Written by</p>
              <p className="mt-1 font-serif text-xl font-semibold">{post.authorName}</p>
              {post.authorRole ? <p className="text-sm text-muted">{post.authorRole}</p> : null}
              <p className="mt-2 leading-relaxed text-foreground/80">{post.authorBio}</p>
            </div>
          </aside>
        ) : null}
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="bg-accent-soft px-4 py-14">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4">
              <h2 id="related-heading" className="font-serif text-3xl font-bold">Keep Reading</h2>
              <Link href="/blog" className="font-semibold text-accent hover:underline">View all posts →</Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => <PostCard key={p.slug} post={p} />)}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
