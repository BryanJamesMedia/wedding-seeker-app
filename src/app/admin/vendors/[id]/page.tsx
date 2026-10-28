import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getVendor } from "@/lib/admin-data";
import { formatDate, formatMoney } from "@/lib/utils";
import { CreditForm } from "../../client";
import { AdminTable } from "../../table";
import { DeleteVendorButton } from "./delete-vendor";

export const metadata = { title: "Vendor · Admin" };

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = /^[A-Za-z0-9_-]{1,100}$/.test(id) ? await getVendor(id) : null;
  if (!data) notFound();
  const v = data.vendor;
  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/vendors" className="text-sm text-accent hover:underline">← Vendors</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl font-semibold">{String(v.email)}</h1>
          <DeleteVendorButton userId={id} email={String(v.email)} owned={Number(v.owned)} balanceCents={Number(v.balance)} leads={Number(v.leads)} />
        </div>
        <p className="text-sm text-muted">
          {[v.contact, v.phone, `Signed up ${formatDate(String(v.signed_up))}`].filter(Boolean).join(" · ")}
        </p>
      </div>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Wallet balance", formatMoney(Number(v.balance))], ["Listings owned", v.owned], ["Leads bought", v.leads], ["Spent on leads", formatMoney(Number(v.spent))]].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-sm text-muted">{label}</p>
          </div>
        ))}
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-serif text-xl font-semibold">Add wallet credit</h2>
        <p className="text-sm text-muted">For support credits and manual refunds. Use a minus amount (for example -5) to remove credit.</p>
        <CreditForm userId={id} />
      </section>
      <section>
        <h2 className="font-serif text-xl font-semibold">Claims and listings</h2>
        <AdminTable
          filename={`vendor-${id}-claims`}
          rows={data.claims}
          defaultSort={{ key: "submitted", desc: true }}
          columns={[
            { key: "listing", label: "Listing", href: "href" },
            { key: "type", label: "Type" },
            { key: "location", label: "Location" },
            { key: "status", label: "Status" },
            { key: "submitted", label: "Submitted", kind: "date" },
          ]}
        />
      </section>
      <section>
        <h2 className="font-serif text-xl font-semibold">Wallet transactions</h2>
        <AdminTable
          filename={`vendor-${id}-wallet`}
          rows={data.transactions}
          defaultSort={{ key: "date", desc: true }}
          columns={[
            { key: "date", label: "Date", kind: "date" },
            { key: "kind", label: "Type" },
            { key: "amount", label: "Amount", kind: "money" },
            { key: "description", label: "Description", wide: true },
          ]}
        />
      </section>
    </div>
  );
}
