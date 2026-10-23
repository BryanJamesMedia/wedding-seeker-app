import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type AppUser } from "@/lib/session";

/** Vendor-side pages: signed-in vendor accounts only. Couple accounts go back to their dashboard. */
/** `signUp` sends signed-out visitors to the sign-up page (e.g. "Sign up and claim your listing" links). */
export async function requireVendor(next = "/vendor", { signUp = false } = {}): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/vendor/${signUp ? "sign-up" : "sign-in"}?next=${encodeURIComponent(next)}`);
  if (user.account_type !== "vendor") redirect("/dashboard");
  return user;
}
