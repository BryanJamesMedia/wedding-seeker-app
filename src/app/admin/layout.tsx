import { requireAdmin } from "@/lib/admin";
import { pendingCounts } from "@/lib/admin-data";
import { AdminNav } from "./nav";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const counts = await pendingCounts();
  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
      <aside>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Admin</p>
        <p className="truncate text-sm text-muted">{user.email}</p>
        <AdminNav counts={counts} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
