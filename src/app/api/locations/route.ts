import { NextResponse } from "next/server";
import { suggestLocations } from "@/lib/location";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limited = await rateLimit(request, "locations", 60);
  if (limited) return limited;
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ suggestions: await suggestLocations(q.slice(0, 60)) });
}
