import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";

export async function GET() {
  const viewer = await getViewer();
  return NextResponse.json(
    { signedIn: Boolean(viewer.user), paid: viewer.paid },
    { headers: { "cache-control": "no-store" } },
  );
}
