import { query } from "@/db";

export type Block =
  | { type: "paragraph"; text: string; dropCap?: boolean }
  | { type: "heading"; text: string; level?: 2 | 3; eyebrow?: string }
  | { type: "image"; src: string; alt: string; caption?: string; aspect?: "wide" | "square" | "portrait" }
  | { type: "imageText"; layout?: "imageLeft" | "imageRight"; src: string; alt: string; heading?: string; text: string }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "checklist"; title?: string; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][]; caption?: string }
  | { type: "callout"; variant?: "info" | "tip" | "warning"; title?: string; text: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "cta"; heading: string; text?: string; buttonLabel: string; buttonHref: string };

const BLOCK_TYPES = new Set<Block["type"]>([
  "paragraph", "heading", "image", "imageText", "steps", "checklist", "table", "callout", "quote", "faq", "cta",
]);

/** Keeps only recognised blocks so a malformed row never breaks the page. */
export function parseBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is Block => Boolean(b) && typeof b === "object" && BLOCK_TYPES.has((b as Block).type));
}

export type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  readMinutes: number;
  featured: boolean;
  publishedAt: Date;
  updatedAt: Date;
};

export type BlogPost = BlogPostSummary & {
  subtitle: string | null;
  tags: string[];
  blocks: Block[];
  authorName: string | null;
  authorRole: string | null;
  authorImage: string | null;
  authorBio: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

type Row = {
  slug: string; title: string; excerpt: string | null; category: string | null; featured_image: string | null;
  featured_image_alt: string | null; read_minutes: number; featured: boolean; published_at: Date; updated_at: Date;
  subtitle?: string | null; tags?: string[]; blocks?: unknown; author_name?: string | null; author_role?: string | null;
  author_image?: string | null; author_bio?: string | null; seo_title?: string | null; seo_description?: string | null;
};

// ~1,200 characters of block JSON per minute of reading when read_minutes is not set.
const SUMMARY_COLUMNS = `slug, title, excerpt, category, featured_image, featured_image_alt, featured, published_at, updated_at,
  coalesce(read_minutes, greatest(1, round(length(blocks::text) / 1200.0)))::int AS read_minutes`;

function toSummary(r: Row): BlogPostSummary {
  return {
    slug: r.slug, title: r.title, excerpt: r.excerpt, category: r.category, featuredImage: r.featured_image,
    featuredImageAlt: r.featured_image_alt, readMinutes: r.read_minutes, featured: r.featured,
    publishedAt: new Date(r.published_at), updatedAt: new Date(r.updated_at),
  };
}

/** The blog_posts table may not exist yet on a database where the migration hasn't been run. */
async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return fallback;
    throw error;
  }
}

export function listPosts({ limit = 100, category }: { limit?: number; category?: string } = {}): Promise<BlogPostSummary[]> {
  return safe(async () => {
    const rows = await query<Row>(
      `SELECT ${SUMMARY_COLUMNS} FROM blog_posts
       WHERE published AND published_at <= now() AND ($2::text IS NULL OR lower(category) = lower($2))
       ORDER BY published_at DESC LIMIT $1`,
      [limit, category ?? null],
    );
    return rows.map(toSummary);
  }, []);
}

export function listCategories(): Promise<string[]> {
  return safe(async () => {
    const rows = await query<{ category: string }>(
      `SELECT min(category) AS category FROM blog_posts
       WHERE published AND published_at <= now() AND category IS NOT NULL GROUP BY lower(category) ORDER BY 1`,
    );
    return rows.map((r) => r.category);
  }, []);
}

export function getPost(slug: string): Promise<BlogPost | null> {
  return safe(async () => {
    const [r] = await query<Row>(
      `SELECT ${SUMMARY_COLUMNS}, subtitle, tags, blocks, author_name, author_role, author_image, author_bio, seo_title, seo_description
       FROM blog_posts WHERE slug = $1 AND published AND published_at <= now()`,
      [slug],
    );
    if (!r) return null;
    return {
      ...toSummary(r), subtitle: r.subtitle ?? null, tags: r.tags ?? [], blocks: parseBlocks(r.blocks),
      authorName: r.author_name ?? null, authorRole: r.author_role ?? null, authorImage: r.author_image ?? null,
      authorBio: r.author_bio ?? null, seoTitle: r.seo_title ?? null, seoDescription: r.seo_description ?? null,
    };
  }, null);
}

/** Same-category posts first, then the newest others. */
export function relatedPosts(post: Pick<BlogPost, "slug" | "category">, limit = 3): Promise<BlogPostSummary[]> {
  return safe(async () => {
    const rows = await query<Row>(
      `SELECT ${SUMMARY_COLUMNS} FROM blog_posts
       WHERE published AND published_at <= now() AND slug <> $1
       ORDER BY (lower(category) IS NOT DISTINCT FROM lower($2)) DESC, published_at DESC LIMIT $3`,
      [post.slug, post.category, limit],
    );
    return rows.map(toSummary);
  }, []);
}

export function formatPostDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
