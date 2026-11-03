import { requireUser } from "@/lib/session";
import { getWeddingProfile } from "@/lib/connections";
import { listCategories } from "@/lib/search";
import { WeddingForm } from "./form";

export default async function WeddingPage() {
  const user = await requireUser("/dashboard/wedding");
  const [profile, categories] = await Promise.all([getWeddingProfile(user.id), listCategories()]);
  const vendorCategories = categories.filter((c) => c.listingType === "vendor").map((c) => c.category);
  return (
    <div>
      <h1 className="font-serif text-4xl font-semibold">My Wedding</h1>
      <p className="mt-1 text-muted">These details pre-fill every Connect request.</p>
      <WeddingForm initial={{ ...(profile ?? {}), contact_email: profile?.contact_email || user.email }} vendorCategories={vendorCategories} />
    </div>
  );
}
