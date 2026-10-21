import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBalance, getLead } from "@/lib/leads";
import { requireVendor } from "@/lib/vendor-auth";
import { formatMoney } from "@/lib/utils";
import { LeadDetails, categoryOf, coupleName } from "../../lead-ui";
import { PurchaseButton } from "./purchase-button";

export default async function ConnectionRequestPage({ params }: PageProps<"/vendor/requests/[id]">) {
  const { id } = await params;
  const user = await requireVendor(`/vendor/requests/${id}`);
  const [lead, balance] = await Promise.all([getLead(user.id, id), getBalance(user.id)]);
  if (!lead) notFound();
  if (lead.purchased_at) redirect(`/vendor/leads/${id}`);
  const short = balance < lead.price_cents;
  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/vendor/requests" className="text-sm text-muted hover:text-accent">← Connection Requests</Link>
      <div>
        <h1 className="font-serif text-3xl font-semibold">{coupleName(lead.snapshot)}</h1>
        <p className="text-sm text-muted">Wants to connect with {lead.listing_name} · {categoryOf(lead)}</p>
      </div>
      <LeadDetails lead={lead} />
      <div className="space-y-3 rounded-3xl border border-accent bg-accent-soft p-6">
        <p className="text-sm">
          Purchase this connection for <strong className="text-base">{formatMoney(lead.price_cents)}</strong> to get the couple&apos;s email and phone number.
          We&apos;ll also let them know you&apos;re interested.
        </p>
        <p className="text-sm text-muted">Your wallet balance: {formatMoney(balance)}</p>
        {short ? (
          <p role="status" className="rounded-xl bg-white p-3 text-sm text-red-700">
            Your wallet balance isn&apos;t enough to purchase this lead. Add funds to your wallet first.
          </p>
        ) : null}
        <PurchaseButton requestId={lead.id} />
      </div>
    </div>
  );
}
