import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <h2>Using Wedding Seeker</h2>
      <p>Wedding Seeker is a directory that helps couples find wedding venues and vendors. Listing information comes from public sources and vendors and may be incomplete or out of date; always confirm details directly with the vendor.</p>
      <h2>Accounts and Plus</h2>
      <p>You need an account to save listings and send Connect requests. Wedding Seeker Plus is a paid plan billed through Stripe. You can manage or cancel billing from Settings.</p>
      <h2>Connect requests</h2>
      <p>When you send a Connect request we email your wedding details to the vendor. Your email and phone are shared only if the vendor responds that they are interested. Don&apos;t send spam or misleading requests; we may limit or close accounts that do.</p>
      <h2>No guarantees</h2>
      <p>We don&apos;t guarantee that a vendor will respond, be available, or perform services. Contracts you sign with vendors are between you and the vendor.</p>
      <h2>Contact</h2>
      <p>Questions? Email support@weddingseeker.com.</p>
    </LegalPage>
  );
}
