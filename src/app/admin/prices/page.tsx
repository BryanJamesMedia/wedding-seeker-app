import { requireAdmin } from "@/lib/admin";
import { listLeadPrices } from "@/lib/admin-data";
import { DEFAULT_LEAD_PRICE_CENTS } from "@/lib/leads";
import { PriceRow } from "../client";

export const metadata = { title: "Lead Prices · Admin" };

export default async function PricesPage() {
  await requireAdmin();
  const prices = await listLeadPrices();
  const vendorDefault = prices.vendor ?? DEFAULT_LEAD_PRICE_CENTS;
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Lead Prices</h1>
      <p className="text-sm text-muted">
        What a vendor pays to purchase a connection request. New prices apply to leads not yet purchased; past purchases keep the price paid.
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-accent-soft text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Active listings</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2"><span className="sr-only">Save</span></th>
            </tr>
          </thead>
          <tbody>
            <PriceRow listingType="venue" category="*" label="All venues" cents={prices.venue ?? DEFAULT_LEAD_PRICE_CENTS} />
            <PriceRow listingType="vendor" category="*" label="Vendor default (categories without their own price)" cents={vendorDefault} />
            {prices.categories.map((c) => (
              <PriceRow key={c.category} listingType="vendor" category={c.category} label={c.label} cents={c.price_cents} fallbackCents={vendorDefault} listings={c.listings} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
