"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/admin", "Overview", null],
  ["/admin/couples", "Couples", null],
  ["/admin/vendors", "Vendors", null],
  ["/admin/claims", "Claim Requests", "claims"],
  ["/admin/add-requests", "Add Requests", "adds"],
  ["/admin/connections", "Connection Requests", null],
  ["/admin/prices", "Lead Prices", null],
  ["/admin/inbox", "Inbox", "inbox"],
  ["/admin/settings", "Settings", null],
] as const;

export function AdminNav({ counts }: { counts: { claims: number; adds: number; inbox: number } }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="mt-2 flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map(([href, label, countKey]) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        const count = countKey ? counts[countKey] : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm ${active ? "bg-foreground text-white" : "hover:bg-accent-soft"}`}
          >
            {label}
            {count > 0 ? <span className="rounded-full bg-accent px-2 text-xs font-semibold text-white">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
