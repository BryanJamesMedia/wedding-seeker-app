import { requireAdmin } from "@/lib/admin";
import { listAddRequests, parseReviewStatus } from "@/lib/admin-data";
import { StatusTabs } from "../chart";
import { AdminTable } from "../table";

export const metadata = { title: "Add Requests · Admin" };

export default async function AddRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const status = parseReviewStatus((await searchParams).status);
  const rows = await listAddRequests(status);
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Add Requests</h1>
      <p className="text-sm text-muted">
        New listings vendors asked to add. Approving makes the listing live and the requester its owner; rejecting keeps it hidden.
        The listing email is notified either way.
      </p>
      <StatusTabs base="/admin/add-requests" current={status} />
      <AdminTable
        filename={`add-requests-${status}`}
        rows={rows}
        review="/api/admin/listing-requests"
        defaultSort={{ key: "submitted", desc: true }}
        columns={[
          { key: "status", label: "Status" },
          { key: "submitted", label: "Submitted", kind: "date" },
          { key: "listing", label: "Name", href: "listing_href" },
          { key: "type", label: "Type" },
          { key: "address", label: "Address" },
          { key: "location", label: "City / State / ZIP" },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Listing email" },
          { key: "website", label: "Website" },
          { key: "account_email", label: "Requested by", href: "account_href" },
          { key: "description", label: "Description", wide: true },
          { key: "reviewed", label: "Reviewed", kind: "date" },
        ]}
      />
    </>
  );
}
