import Link from "next/link";
import { requireUser } from "@/lib/session";
import { DashboardNav } from "./nav";

export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[200px_1fr]">
      <aside>
        <p className="truncate text-sm text-muted">{user.email}</p>
        <DashboardNav />
        <Link href="/search" className="mt-4 hidden rounded-full border border-border px-4 py-2 text-center text-sm md:block">
          New search
        </Link>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
