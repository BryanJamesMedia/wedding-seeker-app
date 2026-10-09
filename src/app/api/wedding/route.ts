import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getWeddingProfile, upsertWeddingProfile } from "@/lib/connections";
import { WeddingProfileSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ profile: await getWeddingProfile(user.id), email: user.email, name: user.name });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const parsed = WeddingProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid details" }, { status: 400 });
  await upsertWeddingProfile(user.id, { ...parsed.data, wedding_date: parsed.data.wedding_date || null });
  return NextResponse.json({ ok: true });
}
