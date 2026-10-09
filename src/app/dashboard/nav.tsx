"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/dashboard", "Overview"],
  ["/dashboard/saved", "Saved"],
  ["/dashboard/connections", "Connections"],
  ["/dashboard/wedding", "My Wedding"],
  ["/dashboard/settings", "Settings"],
] as const;

export function DashboardNav() {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard" className="mt-2 flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map(([href, label]) => {
        const active = href === "/dashboard" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${active ? "bg-foreground text-white" : "hover:bg-accent-soft"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
