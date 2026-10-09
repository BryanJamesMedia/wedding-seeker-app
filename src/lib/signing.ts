import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const value = process.env.SIGNING_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("SIGNING_SECRET is not set");
  return value;
}

/** Compact signed token: base64url(payload).base64url(hmac). */
export function signToken(payload: Record<string, unknown>, ttlDays = 90): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlDays * 86_400_000 })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string | null | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}
