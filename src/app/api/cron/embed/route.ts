import { NextResponse } from "next/server";
import { backfillEmbeddings } from "@/lib/embed-listings";

export const maxDuration = 300;

/** Vercel Cron: embeds new or edited listings. Protected by CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await backfillEmbeddings({ limit: 1000 }));
}
