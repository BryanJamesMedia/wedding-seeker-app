import { requireAdmin } from "@/lib/admin";
import { listConnections } from "@/lib/admin-data";
import { AdminTable } from "../table";

export const metadata = { title: "Connection Requests · Admin" };

export default async function ConnectionsPage() {
  await requireAdmin();
  const rows = await listConnections();
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Connection Requests</h1>
      <p className="text-sm text-muted">Every Connect request from a couple to a vendor or venue. Click the date to see all details.</p>
      <AdminTable
        filename="connection-requests"
        rows={rows}
        defaultSort={{ key: "requested", desc: true }}
        columns={[
          { key: "requested", label: "Requested", kind: "date", href: "href" },
          { key: "couple", label: "Couple" },
          { key: "couple_email", label: "Couple email" },
          { key: "couple_phone", label: "Couple phone" },
          { key: "wedding", label: "Wedding date", sortKey: "wedding_sort" },
          { key: "guests", label: "Guests", kind: "number" },
          { key: "budget", label: "Budget" },
          { key: "location", label: "Wedding location" },
          { key: "listing", label: "Vendor / venue", href: "listing_href" },
          { key: "type", label: "Category" },
          { key: "listing_location", label: "Vendor location" },
          { key: "status", label: "Status" },
          { key: "sent_to", label: "Sent to" },
          { key: "price", label: "Lead price paid", kind: "money" },
          { key: "purchased_by", label: "Bought by" },
        ]}
      />
    </>
  );
}
