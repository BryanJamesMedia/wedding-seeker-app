/* eslint-disable @next/next/no-img-element -- post images can be hosted anywhere */
import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog";
import { cn } from "@/lib/utils";

export const POST_IMAGE_FALLBACK = "/blog/blog-planning-hero.jpg";

/** Photo card with the title over a dark gradient, as on the marketing site's "From The Blog". */
export function PostOverlayCard({ post, large = false }: { post: BlogPostSummary; large?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className={cn("group relative block overflow-hidden rounded-2xl", large ? "h-[400px] md:row-span-2 md:h-full md:min-h-[600px] md:col-span-2" : "h-[290px]")}>
      <img src={post.featuredImage || POST_IMAGE_FALLBACK} alt={post.featuredImageAlt || post.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy/95 via-navy/40 to-transparent" />
      <div className={cn("absolute inset-x-0 bottom-0", large ? "p-6 md:p-8" : "p-5")}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/80">
          {[post.category, `${post.readMinutes} min read`].filter(Boolean).join(" · ")}
        </p>
        <h3 className={cn("font-serif font-bold leading-tight text-white", large ? "text-2xl md:text-3xl" : "line-clamp-3 text-lg")}>{post.title}</h3>
        {large && post.excerpt ? <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/90 md:text-base">{post.excerpt}</p> : null}
      </div>
    </Link>
  );
}

export function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="aspect-[16/10] overflow-hidden bg-accent-soft">
        <img src={post.featuredImage || POST_IMAGE_FALLBACK} alt={post.featuredImageAlt || post.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-coral">
          {[post.category, `${post.readMinutes} min read`].filter(Boolean).join(" · ")}
        </p>
        <h3 className="mt-2 font-serif text-lg font-bold leading-snug group-hover:text-accent">{post.title}</h3>
        {post.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p> : null}
        <span className="mt-auto pt-4 text-sm font-semibold text-accent">Read more →</span>
      </div>
    </Link>
  );
}
