import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  const production = process.env.VERCEL_ENV === "production" || !process.env.VERCEL_ENV;
  return {
    rules: production
      ? { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/search", "/auth/", "/upgrade", "/r/"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
