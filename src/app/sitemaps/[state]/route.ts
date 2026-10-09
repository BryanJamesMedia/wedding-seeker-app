import { query } from "@/db";
import { APP_URL } from "@/lib/urls";
import { listingHref } from "@/lib/search";
import { escapeXml, stateSlug } from "@/lib/sitemap";

export const revalidate = 3600;

const STATIC_PAGES = ["/", "/terms", "/privacy"];

export async function GET(_request: Request, { params }: RouteContext<"/sitemaps/[state]">) {
  const { state } = await params;
  let urls: { loc: string; lastmod?: string }[];
  if (state === "pages") {
    urls = STATIC_PAGES.map((p) => ({ loc: `${APP_URL}${p}` }));
  } else {
    const rows = await query<{ listing_type: string; slug: string; category: string | null; city: string | null; state: string | null; updated_at: Date }>(
      `SELECT listing_type, slug, category, city, state, updated_at FROM listings
       WHERE status = 'active' AND state IS NOT NULL
         AND trim(both '-' from regexp_replace(lower(state), '[^a-z0-9]+', '-', 'g')) = $1
       LIMIT 50000`,
      [state],
    );
    if (rows.length === 0 || stateSlug(rows[0].state!) !== state) return new Response("Not found", { status: 404 });
    urls = rows.map((r) => ({ loc: `${APP_URL}${listingHref(r)}`, lastmod: new Date(r.updated_at).toISOString() }));
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`;
  return new Response(body, { headers: { "content-type": "application/xml" } });
}
