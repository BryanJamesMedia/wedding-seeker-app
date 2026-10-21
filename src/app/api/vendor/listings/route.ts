import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isListingType } from "@/lib/saves";
import { ownsListing, parseEditable, updateListing } from "@/lib/vendor";

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.account_type !== "vendor") return NextResponse.json({ error: "Please sign in to your vendor account." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !isListingType(body.listingType) || typeof body.listingId !== "string" || typeof body.values !== "object" || !body.values) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const ref = { listingType: body.listingType, listingId: body.listingId };
  if (!(await ownsListing(user.id, ref))) {
    return NextResponse.json({ error: "You can edit a listing once your claim is approved." }, { status: 403 });
  }
  const parsed = parseEditable(body.values);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await updateListing(ref, parsed.values);
  return NextResponse.json({ ok: true });
}
