import { getCurrentUser } from "@/lib/session";
import { VendorNav } from "./nav";

export const metadata = { title: "Vendor dashboard", robots: { index: false } };

/** Each page calls requireVendor with its own path, so sign-in returns to the page the vendor asked for. */
export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user?.account_type !== "vendor") return children;
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
      <aside>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Vendor dashboard</p>
        <p className="truncate text-sm text-muted">{user.email}</p>
        <VendorNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
