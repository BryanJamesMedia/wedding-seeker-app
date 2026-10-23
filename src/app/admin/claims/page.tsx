import { requireAdmin } from "@/lib/admin";
import { listClaimRequests, parseReviewStatus } from "@/lib/admin-data";
import { StatusTabs } from "../chart";
import { AdminTable } from "../table";

export const metadata = { title: "Claim Requests · Admin" };

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const status = parseReviewStatus((await searchParams).status);
  const rows = await listClaimRequests(status);
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Claim Requests</h1>
      <p className="text-sm text-muted">
        Check the claimer&apos;s details against what&apos;s on file, then approve or reject. The vendor is emailed either way. Listings added with
        &quot;Request to Add&quot; are reviewed under Add Requests.
      </p>
      <StatusTabs base="/admin/claims" current={status} />
      <AdminTable
        filename={`claim-requests-${status}`}
        rows={rows}
        review="/api/admin/claims"
        defaultSort={{ key: "submitted", desc: true }}
        columns={[
          { key: "status", label: "Status" },
          { key: "submitted", label: "Submitted", kind: "date" },
          { key: "listing", label: "Listing", href: "listing_href" },
          { key: "type", label: "Type" },
          { key: "location", label: "Location" },
          { key: "claimant", label: "Claimer" },
          { key: "role", label: "Role" },
          { key: "phone", label: "Claimer phone" },
          { key: "account_email", label: "Account email", href: "account_href" },
          { key: "file_phone", label: "Phone on file" },
          { key: "file_email", label: "Email on file" },
          { key: "website", label: "Website" },
          { key: "note", label: "Note", wide: true },
          { key: "reviewed", label: "Reviewed", kind: "date" },
        ]}
      />
    </>
  );
}
