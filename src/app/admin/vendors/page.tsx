import { requireAdmin } from "@/lib/admin";
import { listVendors } from "@/lib/admin-data";
import { AdminTable } from "../table";

export const metadata = { title: "Vendors · Admin" };

export default async function VendorsPage() {
  await requireAdmin();
  const rows = await listVendors();
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Vendors</h1>
      <p className="text-sm text-muted">Vendor and venue accounts. Click an email to see their listings and wallet, or to add credit.</p>
      <AdminTable
        filename="vendors"
        rows={rows}
        defaultSort={{ key: "signed_up", desc: true }}
        columns={[
          { key: "email", label: "Email", href: "href" },
          { key: "contact", label: "Contact name" },
          { key: "phone", label: "Phone" },
          { key: "signed_up", label: "Signed up", kind: "date" },
          { key: "listings", label: "Listings owned", wide: true },
          { key: "owned", label: "# Owned", kind: "number" },
          { key: "pending", label: "Pending claims", kind: "number" },
          { key: "balance", label: "Wallet", kind: "money" },
          { key: "leads", label: "Leads bought", kind: "number" },
          { key: "spent", label: "Spent on leads", kind: "money" },
        ]}
      />
    </>
  );
}
