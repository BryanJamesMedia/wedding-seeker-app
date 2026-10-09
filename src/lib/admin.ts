import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser, type AppUser } from "./session";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "b@lekmedia.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(user: AppUser | null): boolean {
  return Boolean(user && (user.is_admin || ADMIN_EMAILS.includes(user.email.toLowerCase())));
}

export async function getAdmin(): Promise<AppUser | null> {
  const user = await getCurrentUser();
  return isAdmin(user) ? user : null;
}

/** Admin pages 404 for everyone else so the route isn't discoverable. */
export async function requireAdmin(): Promise<AppUser> {
  const user = await getAdmin();
  if (!user) notFound();
  return user;
}
