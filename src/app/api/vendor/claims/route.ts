import { NextResponse, after } from "next/server";
import { notifyClaimSubmitted } from "@/lib/claim-notice";
import { getCurrentUser } from "@/lib/session";
import { isListingType } from "@/lib/saves";
import { createClaim } from "@/lib/vendor";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.account_type !== "vendor") return NextResponse.json({ error: "Only vendor accounts can claim listings." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !isListingType(body.listingType) || typeof body.listingId !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = {
    claimantName: text(body.claimantName, 200),
    claimantRole: text(body.claimantRole, 200),
    claimantPhone: text(body.claimantPhone, 40),
    note: text(body.note, 1000) || null,
  };
  if (!input.claimantName || !input.claimantRole || !input.claimantPhone) {
    return NextResponse.json({ error: "Please fill in your name, role and phone number." }, { status: 400 });
  }
  const result = await createClaim(user.id, { listingType: body.listingType, listingId: body.listingId }, input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.status === "pending") after(() => notifyClaimSubmitted(result.claimId, result.isNew));
  return NextResponse.json({ status: result.status });
}
