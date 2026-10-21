import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { missingWeddingFields } from "@/lib/wedding-requirements";
import { isListingType } from "@/lib/saves";
import { ConnectError, createConnection, getWeddingProfile, upsertWeddingProfile } from "@/lib/connections";
import { rateLimit } from "@/lib/rate-limit";
import { WeddingProfileSchema } from "@/lib/validation";


const Body = z.object({
  listingType: z.string(),
  listingId: z.string().min(1).max(64),
  message: z.string().max(2000).default(""),
  profile: WeddingProfileSchema,
  saveToProfile: z.boolean().default(true),
});

export async function POST(request: Request) {
  const limited = await rateLimit(request, "connect", 20);
  if (limited) return limited;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.account_type === "vendor") {
    return NextResponse.json({ error: "Vendor accounts can't send connection requests." }, { status: 403 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isListingType(parsed.data.listingType)) {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }
  const { listingType, listingId, message, profile, saveToProfile } = parsed.data;
  const clean = { ...profile, wedding_date: profile.wedding_date || null };
  if (saveToProfile) await upsertWeddingProfile(user.id, clean);
  const missing = missingWeddingFields(await getWeddingProfile(user.id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Please complete your wedding details in My Wedding before connecting with vendors.", code: "wedding_incomplete", missing },
      { status: 403 },
    );
  }
  try {
    return NextResponse.json(await createConnection(user, { listingType, listingId }, { profile: clean, message }));
  } catch (error) {
    if (error instanceof ConnectError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
