import Link from "next/link";
import { listLeads } from "@/lib/leads";
import { requireVendor } from "@/lib/vendor-auth";
import { LeadTable, parseSort } from "../lead-ui";

export default async function YourLeadsPage({ searchParams }: PageProps<"/vendor/leads">) {
  const user = await requireVendor("/vendor/leads");
  const [rows, { sort }] = await Promise.all([listLeads(user.id, true), searchParams]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Your Leads</h1>
        <p className="text-sm text-muted">Couples you&apos;ve connected with. Reach out by email or phone.</p>
      </div>
      {rows.length ? (
        <LeadTable rows={rows} purchased basePath="/vendor/leads" sort={parseSort(sort)} />
      ) : (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted">
          You haven&apos;t purchased any leads yet. <Link href="/vendor/requests" className="text-accent underline">See your connection requests</Link>.
        </p>
      )}
    </div>
  );
}
