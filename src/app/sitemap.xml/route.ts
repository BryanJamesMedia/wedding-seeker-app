import { query } from "@/db";
import { APP_URL } from "@/lib/urls";
import { stateSlug } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** Sitemap index with one child sitemap per state. */
export async function GET() {
  const states = await query<{ state: string; updated: Date }>(
    `SELECT state, max(updated_at) AS updated FROM listings WHERE status = 'active' AND state IS NOT NULL GROUP BY state ORDER BY state`,
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>${APP_URL}/sitemaps/pages</loc></sitemap>
${states.map((s) => `<sitemap><loc>${APP_URL}/sitemaps/${stateSlug(s.state)}</loc><lastmod>${new Date(s.updated).toISOString()}</lastmod></sitemap>`).join("\n")}
</sitemapindex>`;
  return new Response(body, { headers: { "content-type": "application/xml", "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
