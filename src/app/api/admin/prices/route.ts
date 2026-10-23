import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/db";
import { getAdmin } from "@/lib/admin";

const Body = z
  .object({
    listingType: z.enum(["venue", "vendor"]),
    category: z.string().trim().toLowerCase().min(1).max(100),
    priceCents: z.number().int().min(0).max(100_000),
  })
  .refine((b) => b.listingType === "vendor" || b.category === "*", "Venues have one price");

export async function POST(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { listingType, category, priceCents } = parsed.data;
  await query(
    `INSERT INTO lead_prices (listing_type, category, price_cents) VALUES ($1, $2, $3)
     ON CONFLICT (listing_type, category) DO UPDATE SET price_cents = EXCLUDED.price_cents, updated_at = now()`,
    [listingType, category, priceCents],
  );
  return NextResponse.json({ ok: true });
}
