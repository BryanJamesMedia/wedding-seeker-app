import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: email, name, and sign-in provider.</li>
        <li>Wedding details you enter: names, date, location, guest count, budget, style.</li>
        <li>Searches, saved listings and Connect requests, used to run and improve the service.</li>
        <li>Payment status from Stripe. We never see or store your card number.</li>
      </ul>
      <h2>How we share it</h2>
      <p>Your wedding details go to vendors only when you send a Connect request. Your contact details are shared only with vendors who respond that they&apos;re interested. We use service providers (hosting, email, payments) to operate Wedding Seeker. We don&apos;t sell your personal information.</p>
      <h2>Your choices</h2>
      <p>You can change email preferences or delete your account at any time from Settings. Deleting your account removes your profile, saves and searches.</p>
      <h2>Contact</h2>
      <p>privacy@weddingseeker.com</p>
    </LegalPage>
  );
}
