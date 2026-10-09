import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Fixed-window in-memory limiter per instance. Pair with Vercel Firewall rate
 * limiting in production for cross-instance protection.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function clientIp(request?: Request): Promise<string> {
  const h = request?.headers ?? (await headers());
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function isRateLimited(key: string, limit: number, windowMs = 60_000): Promise<boolean> {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    return false;
  }
  bucket.count++;
  return bucket.count > limit;
}

export async function rateLimit(request: Request, name: string, perMinute: number) {
  const ip = await clientIp(request);
  if (await isRateLimited(`${name}:${ip}`, perMinute)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}
