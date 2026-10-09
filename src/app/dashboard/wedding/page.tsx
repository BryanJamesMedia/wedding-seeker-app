import { requireUser } from "@/lib/session";
import { getWeddingProfile } from "@/lib/connections";
import { WeddingForm } from "./form";

export default async function WeddingPage() {
  const user = await requireUser("/dashboard/wedding");
  const profile = await getWeddingProfile(user.id);
  return (
    <div>
      <h1 className="font-serif text-4xl font-semibold">My Wedding</h1>
      <p className="mt-1 text-muted">These details pre-fill every Connect request.</p>
      <WeddingForm initial={{ contact_email: user.email, ...(profile ?? {}) }} />
    </div>
  );
}
