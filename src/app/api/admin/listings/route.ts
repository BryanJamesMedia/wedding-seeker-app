import { NextResponse, after } from "next/server";
import { getAdmin } from "@/lib/admin";
import { deleteListing, isListingId, notifyListingDeleted, parseAdminEdit, updateAdminListing } from "@/lib/admin-listings";
import { isRateLimited } from "@/lib/rate-limit";
import { isListingType } from "@/lib/saves";

async function readRef(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !isListingType(body.listingType) || typeof body.listingId !== "string" || !isListingId(body.listingType, body.listingId)) return null;
  return { body, ref: { listingType: body.listingType, listingId: body.listingId } };
}

export async function PUT(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const read = await readRef(request);
  if (!read || typeof read.body.values !== "object" || !read.body.values) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const edit = parseAdminEdit(read.ref.listingType, read.body.values);
  if ("error" in edit) return NextResponse.json({ error: edit.error }, { status: 400 });
  if (!(await updateAdminListing(read.ref, edit))) return NextResponse.json({ error: "This listing no longer exists." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** One listing per call, only after typing DELETE, and at most 5 per minute per admin. */
export async function DELETE(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const read = await readRef(request);
  if (!read) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (read.body.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  if (await isRateLimited(`admin-listing-delete:${admin.id}`, 5)) {
    return NextResponse.json({ error: "Too many deletes. Wait a minute and try again." }, { status: 429 });
  }
  const deleted = await deleteListing(read.ref, admin.email);
  if (!deleted) return NextResponse.json({ error: "This listing no longer exists." }, { status: 404 });
  after(() => notifyListingDeleted(read.ref, deleted, admin.email));
  return NextResponse.json({ ok: true, deleted });
}
