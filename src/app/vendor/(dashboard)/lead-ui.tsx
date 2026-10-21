import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { weddingWhen } from "@/lib/connections";
import type { Lead, LeadSnapshot } from "@/lib/leads";
import { formatDate, formatMoney } from "@/lib/utils";

export function coupleName(s: LeadSnapshot): string {
  return [s.partner1_name, s.partner2_name].filter(Boolean).join(" & ") || "Couple";
}

function weddingLabel(s: LeadSnapshot): string {
  return s.when ?? weddingWhen(s) ?? "—";
}

function weddingSortKey(s: LeadSnapshot): string {
  if (s.wedding_date) return s.wedding_date;
  if (s.target_year) return `${s.target_year}-${String(s.target_month ?? 12).padStart(2, "0")}-01`;
  return "9999";
}

export type SortKey = "requested" | "wedding" | "guests";

export function parseSort(value: string | string[] | undefined): { key: SortKey; desc: boolean } {
  const v = typeof value === "string" ? value : "";
  const [key, dir] = v.split(".");
  return { key: key === "wedding" || key === "guests" ? key : "requested", desc: dir ? dir === "desc" : key !== "wedding" };
}

function sortLeads(rows: Lead[], { key, desc }: { key: SortKey; desc: boolean }): Lead[] {
  const value = (l: Lead): string | number =>
    key === "wedding" ? weddingSortKey(l.snapshot) : key === "guests" ? Number(l.snapshot.guest_count ?? 0) : new Date(l.purchased_at ?? l.created_at).getTime();
  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
  });
}

/** Spreadsheet-style table of connection requests or purchased leads. */
export function LeadTable({ rows, purchased, basePath, sort }: { rows: Lead[]; purchased: boolean; basePath: string; sort: { key: SortKey; desc: boolean } }) {
  const showListing = new Set(rows.map((r) => `${r.listing_type}:${r.listing_id}`)).size > 1;
  const head = (key: SortKey, label: string) => {
    const active = sort.key === key;
    const next = `${key}.${active && sort.desc ? "asc" : active ? "desc" : key === "wedding" ? "asc" : "desc"}`;
    return (
      <th scope="col" className="px-3 py-2" aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}>
        <Link href={`${basePath}?sort=${next}`} className="inline-flex items-center gap-1 hover:text-accent">
          {label}
          <span aria-hidden className="text-xs">{active ? (sort.desc ? "▼" : "▲") : "↕"}</span>
        </Link>
      </th>
    );
  };
  const cell = "whitespace-nowrap px-3 py-2";
  const wrap = "min-w-32 px-3 py-2";
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="border-b border-border bg-accent-soft text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-3 py-2">Couple</th>
            {head("requested", purchased ? "Purchased" : "Requested")}
            {head("wedding", "Wedding date")}
            {head("guests", "Guests")}
            <th scope="col" className="px-3 py-2">Budget</th>
            <th scope="col" className="px-3 py-2">Location</th>
            {purchased ? <th scope="col" className="px-3 py-2">Phone</th> : null}
            {purchased ? <th scope="col" className="px-3 py-2">Email</th> : null}
            {showListing ? <th scope="col" className="px-3 py-2">Listing</th> : null}
            <th scope="col" className="px-3 py-2">{purchased ? "Paid" : "Price"}</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {sortLeads(rows, sort).map((r) => {
            const href = `${basePath}/${r.id}`;
            return (
              <tr key={r.id} className="border-b border-border last:border-0 odd:bg-white even:bg-black/[0.015] hover:bg-accent-soft/60">
                <td className={`${wrap} font-medium`}><Link href={href} className="hover:text-accent">{coupleName(r.snapshot)}</Link></td>
                <td className={cell}>{formatDate(r.purchased_at ?? r.created_at)}</td>
                <td className={cell}>{weddingLabel(r.snapshot)}</td>
                <td className={cell}>{r.snapshot.guest_count ?? "—"}</td>
                <td className={cell}>{r.snapshot.budget_range ?? "—"}</td>
                <td className={wrap}>{r.snapshot.location_text ?? "—"}</td>
                {purchased ? <td className={cell}>{r.contact?.phone ?? "—"}</td> : null}
                {purchased ? <td className={cell}>{r.contact?.email ?? "—"}</td> : null}
                {showListing ? <td className={wrap}>{r.listing_name}</td> : null}
                <td className={cell}>{formatMoney(r.price_cents)}</td>
                <td className={cell}><Link href={href} className="text-accent underline">{purchased ? "View" : "View details"}</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Every wedding detail on the request. Email and phone only appear once the lead is purchased. */
export function LeadDetails({ lead }: { lead: Lead }) {
  const s = lead.snapshot;
  const rows: [string, React.ReactNode][] = [
    ["Couple", coupleName(s)],
    ["Wedding date", weddingLabel(s)],
    ["Location", s.location_text],
    ["Guests", s.guest_count],
    ["Budget", s.budget_range],
    ["Setting", s.settings?.length ? s.settings.join(", ") : null],
    ["Vibe", s.vibe],
    ["Also looking for", s.vendors_needed?.length ? s.vendors_needed.map(categoryLabel).join(", ") : null],
    ["Requested", formatDate(lead.created_at)],
    ["Listing", lead.listing_name],
  ];
  if (lead.contact) {
    rows.splice(1, 0,
      ["Email", lead.contact.email ? <a href={`mailto:${lead.contact.email}`} className="text-accent underline">{lead.contact.email}</a> : null],
      ["Phone", lead.contact.phone ? <a href={`tel:${lead.contact.phone}`} className="text-accent underline">{lead.contact.phone}</a> : null],
    );
  }
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[160px_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium">{value == null || value === "" ? "—" : value}</dd>
          </div>
        ))}
      </dl>
      {lead.message ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-sm text-muted">Their message</p>
          <p className="mt-1 whitespace-pre-line text-sm">{lead.message}</p>
        </div>
      ) : null}
    </div>
  );
}

export function categoryOf(lead: Lead): string {
  return lead.listing_type === "venue" ? "Venue" : categoryLabel(lead.category ?? "");
}
