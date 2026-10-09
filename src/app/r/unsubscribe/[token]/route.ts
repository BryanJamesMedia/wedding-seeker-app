import { query } from "@/db";
import { verifyToken } from "@/lib/signing";

async function unsubscribe(token: string) {
  const data = verifyToken<{ e: string | null; l: string }>(token);
  if (!data) return false;
  if (data.e) await query("INSERT INTO vendor_unsubscribes (email) VALUES (lower($1)) ON CONFLICT DO NOTHING", [data.e]);
  const [type, id] = data.l.split(":");
  const table = type === "venue" ? "venues" : type === "vendor" ? "vendors" : null;
  if (table) await query(`UPDATE ${table} SET unsubscribed_at = coalesce(unsubscribed_at, now()) WHERE id::text = $1`, [id]);
  return true;
}

const page = (ok: boolean) =>
  new Response(
    `<!doctype html><meta name="viewport" content="width=device-width"><title>Wedding Seeker</title><body style="font-family:system-ui;max-width:28rem;margin:5rem auto;text-align:center">
     <h1>${ok ? "You're unsubscribed" : "This link has expired"}</h1><p>${ok ? "You won't receive any more couple requests from Wedding Seeker." : "Reply to any of our emails with “unsubscribe”."}</p></body>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html" } },
  );

export async function GET(_req: Request, { params }: RouteContext<"/r/unsubscribe/[token]">) {
  return page(await unsubscribe((await params).token));
}

/** RFC 8058 one-click unsubscribe. */
export async function POST(_req: Request, { params }: RouteContext<"/r/unsubscribe/[token]">) {
  return page(await unsubscribe((await params).token));
}
