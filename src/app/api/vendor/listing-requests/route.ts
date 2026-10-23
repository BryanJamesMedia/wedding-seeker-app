import { NextResponse, after } from "next/server";
import { isListingType } from "@/lib/saves";
import { getCurrentUser } from "@/lib/session";
import { listCategories } from "@/lib/search";
import { US_STATE_CODES } from "@/lib/us-states";
import {
  MAX_PENDING_REQUESTS,
  countPendingRequests,
  createListingRequest,
  findPossibleDuplicates,
  notifyListingRequest,
  type ListingRequestInput,
} from "@/lib/listing-requests";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.account_type !== "vendor") return NextResponse.json({ error: "Only vendor accounts can add listings." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !isListingType(body.listingType)) return NextResponse.json({ error: "Choose Venue or Vendor." }, { status: 400 });

  let category: string | null = null;
  if (body.listingType === "vendor") {
    const wanted = text(body.category, 100).toLowerCase();
    const match = (await listCategories()).find((c) => c.listingType === "vendor" && c.category.toLowerCase() === wanted);
    if (!match) return NextResponse.json({ error: "Choose a vendor category." }, { status: 400 });
    category = match.category;
  }
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  const input: ListingRequestInput = {
    listingType: body.listingType,
    category,
    name: text(body.name, 200),
    address: text(body.address, 200) || null,
    city: text(body.city, 100),
    state: text(body.state, 2).toUpperCase(),
    zip: text(body.zip, 10),
    phone: text(body.phone, 40),
    email: text(body.email, 200).toLowerCase(),
    website: text(body.website, 200).replace(/^https?:\/\//i, "").replace(/\/+$/, "") || null,
    description: description || null,
  };
  if (!input.name || !input.city) return NextResponse.json({ error: "Please fill in the business name and city." }, { status: 400 });
  if (!US_STATE_CODES.has(input.state)) return NextResponse.json({ error: "Choose a state." }, { status: 400 });
  if (!/^\d{5}(-\d{4})?$/.test(input.zip)) return NextResponse.json({ error: "Enter a 5-digit ZIP code." }, { status: 400 });
  if (input.phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Enter a phone number with area code." }, { status: 400 });
  if (!EMAIL.test(input.email)) return NextResponse.json({ error: "Enter a valid listing email." }, { status: 400 });

  if ((await countPendingRequests(user.id)) >= MAX_PENDING_REQUESTS) {
    return NextResponse.json(
      { error: `You already have ${MAX_PENDING_REQUESTS} listings awaiting approval. You can add more once we've reviewed them.` },
      { status: 429 },
    );
  }
  const duplicates = await findPossibleDuplicates(input);
  if (duplicates.length && body.force !== true) return NextResponse.json({ duplicates }, { status: 409 });

  const { requestId } = await createListingRequest(user, input);
  after(() => notifyListingRequest({ requestId, input, account: { email: user.email, name: user.name }, duplicates }));
  return NextResponse.json({ ok: true });
}
