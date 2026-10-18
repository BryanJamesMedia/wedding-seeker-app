import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/cron/geocode": ["./data/zip-centroids.csv"],
  },
};

export default nextConfig;
