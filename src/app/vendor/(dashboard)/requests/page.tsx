import Link from "next/link";
import { getBalance, listLeads } from "@/lib/leads";
import { listClaims } from "@/lib/vendor";
import { requireVendor } from "@/lib/vendor-auth";
import { formatMoney } from "@/lib/utils";
import { LeadTable, parseSort } from "../lead-ui";

export default async function ConnectionRequestsPage({ searchParams }: PageProps<"/vendor/requests">) {
  const user = await requireVendor("/vendor/requests");
  const [rows, balance, claims, { sort }] = await Promise.all([listLeads(user.id, false), getBalance(user.id), listClaims(user.id), searchParams]);
  const hasListing = claims.some((c) => c.status === "approved");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Connection Requests</h1>
          <p className="text-sm text-muted">Couples who want to connect with you. Purchase a request to get their email and phone number.</p>
        </div>
        <p className="rounded-full border border-border bg-card px-4 py-1.5 text-sm">Wallet balance: <strong>{formatMoney(balance)}</strong></p>
      </div>
      {rows.length ? (
        <LeadTable rows={rows} purchased={false} basePath="/vendor/requests" sort={parseSort(sort)} />
      ) : (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted">
          {hasListing ? (
            "No new connection requests yet. We'll email you as soon as a couple wants to connect."
          ) : (
            <>Connection requests appear here once you own a listing. <Link href="/vendor/claim" className="text-accent underline">Claim your listing</Link> to get started.</>
          )}
        </p>
      )}
    </div>
  );
}
