import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadDetails } from "@/app/vendor/(dashboard)/lead-ui";
import { requireAdmin } from "@/lib/admin";
import { connectionStatus, getConnection } from "@/lib/admin-data";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Connection Request · Admin" };

const when = (d: Date | string) =>
  new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";

export default async function ConnectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const data = await getConnection((await params).id);
  if (!data) notFound();
  const { row: c, href, events } = data;
  const s = c.snapshot ?? {};
  const meta: [string, React.ReactNode][] = [
    ["Status", connectionStatus(c)],
    ["Requested", when(c.created_at)],
    ["Vendor / venue", href ? <a href={href} target="_blank" rel="noreferrer" className="text-accent underline">{c.listing_name}</a> : c.listing_name],
    ["Vendor location", [c.city, c.state].filter(Boolean).join(", ")],
    ["Sent to", c.vendor_email],
    ["Couple account email", c.account_email ?? "Deleted account"],
    ["Purchased", c.purchased_at ? `${when(c.purchased_at)} for ${formatMoney(c.price_cents ?? 0)}` : "Not yet"],
    ["Bought by", c.purchaser_id ? <Link href={`/admin/vendors/${c.purchaser_id}`} className="text-accent underline">{c.purchased_by}</Link> : null],
  ];
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/connections" className="text-sm text-accent hover:underline">← Connection Requests</Link>
        <h1 className="mt-2 font-serif text-3xl font-semibold">Connection request</h1>
      </div>
      <dl className="grid gap-x-6 gap-y-3 rounded-3xl border border-border bg-card p-6 text-sm sm:grid-cols-[180px_1fr]">
        {meta.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium">{value == null || value === "" ? "—" : value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h2 className="mb-3 font-serif text-xl font-semibold">Wedding details</h2>
        <LeadDetails
          lead={{
            id: c.id,
            listing_type: c.listing_type,
            listing_id: c.listing_id,
            listing_name: c.listing_name ?? "",
            category: c.category,
            created_at: c.created_at,
            snapshot: s,
            message: c.message,
            price_cents: c.price_cents ?? 0,
            purchased_at: c.purchased_at,
            contact: { email: s.contact_email || c.account_email, phone: s.contact_phone ?? null },
          }}
        />
      </div>
      <section>
        <h2 className="font-serif text-xl font-semibold">History</h2>
        <ol className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card text-sm">
          {events.length === 0 ? <li className="p-4 text-muted">No events recorded.</li> : null}
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-4 p-3">
              <span className="w-48 text-muted">{when(e.created_at)}</span>
              <span className="font-medium">{e.type.replace(/_/g, " ")}</span>
              {e.detail ? <code className="text-xs text-muted">{JSON.stringify(e.detail)}</code> : null}
            </li>
          ))}
        </ol>
      </section>
      <p className="text-xs text-muted">Requested {formatDate(c.created_at)} · ID {c.id}</p>
    </div>
  );
}
