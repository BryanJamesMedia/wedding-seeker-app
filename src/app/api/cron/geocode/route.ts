import { NextResponse } from "next/server";
import { backfillGeocodes } from "@/lib/geocode";

export const maxDuration = 300;

/** Vercel Cron: geocodes listings with no coordinates. Protected by CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await backfillGeocodes({ limit: 5000 }));
}
