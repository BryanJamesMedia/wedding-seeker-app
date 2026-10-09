import { NextResponse } from "next/server";
import { getCurrentUser, isPaid } from "@/lib/session";
import { isListingType, listingExists, saveListing, unsaveListing } from "@/lib/saves";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  if (!isPaid(user)) return NextResponse.json({ error: "upgrade_required" }, { status: 402 });
  const body = (await request.json().catch(() => ({}))) as { listingType?: string; listingId?: string; saved?: boolean };
  if (!isListingType(body.listingType) || typeof body.listingId !== "string") {
    return NextResponse.json({ error: "invalid_listing" }, { status: 400 });
  }
  const ref = { listingType: body.listingType, listingId: body.listingId };
  if (body.saved === false) {
    await unsaveListing(user.id, ref);
    return NextResponse.json({ saved: false });
  }
  if (!(await listingExists(ref))) return NextResponse.json({ error: "invalid_listing" }, { status: 404 });
  await saveListing(user.id, ref);
  return NextResponse.json({ saved: true });
}
