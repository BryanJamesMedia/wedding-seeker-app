import { requireAdmin } from "@/lib/admin";
import { listCouples } from "@/lib/admin-data";
import { AdminTable } from "../table";

export const metadata = { title: "Couples · Admin" };

export default async function CouplesPage() {
  await requireAdmin();
  const rows = await listCouples();
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Couples</h1>
      <p className="text-sm text-muted">Everyone who signed up as a couple, newest first. Click a column to sort.</p>
      <AdminTable
        filename="couples"
        rows={rows}
        defaultSort={{ key: "signed_up", desc: true }}
        columns={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "signed_up", label: "Signed up", kind: "date" },
          { key: "method", label: "Signed up with" },
          { key: "complete", label: "My Wedding complete" },
          { key: "wedding", label: "Wedding date", sortKey: "wedding_sort" },
          { key: "location", label: "Location" },
          { key: "guests", label: "Guests", kind: "number" },
          { key: "budget", label: "Budget" },
          { key: "requests", label: "Requests sent", kind: "number" },
          { key: "saves", label: "Saved", kind: "number" },
          { key: "marketing", label: "Marketing opt-in" },
        ]}
      />
    </>
  );
}
