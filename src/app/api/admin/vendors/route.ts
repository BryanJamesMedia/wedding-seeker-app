import { NextResponse } from "next/server";
import { queryOne } from "@/db";
import { getAdmin, isAdmin } from "@/lib/admin";
import { deleteUserAccount } from "@/lib/account-delete";
import { isRateLimited } from "@/lib/rate-limit";
import type { AppUser } from "@/lib/session";

/** Deletes one vendor account per call, only after typing DELETE, at most 10 per minute per admin. */
export async function DELETE(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  if (typeof userId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(userId)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (body.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  if (await isRateLimited(`admin-vendor-delete:${admin.id}`, 10)) {
    return NextResponse.json({ error: "Too many deletes. Wait a minute and try again." }, { status: 429 });
  }
  const target = await queryOne<AppUser>("SELECT * FROM users WHERE id = $1", [userId]);
  if (!target || target.account_type !== "vendor") return NextResponse.json({ error: "This vendor account no longer exists." }, { status: 404 });
  if (target.id === admin.id || isAdmin(target)) return NextResponse.json({ error: "Admin accounts can't be deleted here." }, { status: 400 });
  await deleteUserAccount(userId);
  return NextResponse.json({ ok: true });
}
