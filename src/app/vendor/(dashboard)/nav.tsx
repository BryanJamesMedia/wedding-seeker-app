"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/vendor", "Overview"],
  ["/vendor/requests", "Connection Requests"],
  ["/vendor/leads", "Your Leads"],
  ["/vendor/claim", "Claim Your Listing"],
  ["/vendor/add", "Add Your Listing"],
  ["/vendor/listings", "Edit Your Listing"],
] as const;

export function VendorNav() {
  const path = usePathname();
  return (
    <nav aria-label="Vendor dashboard" className="mt-2 flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map(([href, label]) => {
        const active = href === "/vendor" ? path === href : path.startsWith(href);
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
