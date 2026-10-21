import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type AppUser } from "@/lib/session";

/** Vendor-side pages: signed-in vendor accounts only. Couple accounts go back to their dashboard. */
export async function requireVendor(next = "/vendor"): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/vendor/sign-in?next=${encodeURIComponent(next)}`);
  if (user.account_type !== "vendor") redirect("/dashboard");
  return user;
}
