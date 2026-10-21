import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLead } from "@/lib/leads";
import { requireVendor } from "@/lib/vendor-auth";
import { formatDate, formatMoney } from "@/lib/utils";
import { LeadDetails, categoryOf, coupleName } from "../../lead-ui";

export default async function LeadPage({ params }: PageProps<"/vendor/leads/[id]">) {
  const { id } = await params;
  const user = await requireVendor(`/vendor/leads/${id}`);
  const lead = await getLead(user.id, id);
  if (!lead) notFound();
  if (!lead.purchased_at) redirect(`/vendor/requests/${id}`);
  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/vendor/leads" className="text-sm text-muted hover:text-accent">← Your Leads</Link>
      <div>
        <h1 className="font-serif text-3xl font-semibold">{coupleName(lead.snapshot)}</h1>
        <p className="text-sm text-muted">
          {lead.listing_name} · {categoryOf(lead)} · Purchased {formatDate(lead.purchased_at)} for {formatMoney(lead.price_cents)}
        </p>
      </div>
      <LeadDetails lead={lead} />
    </div>
  );
}
