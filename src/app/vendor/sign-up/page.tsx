import { VendorAuthPage } from "../vendor-auth-page";

export const metadata = { title: "Vendor sign up", robots: { index: false } };

export default async function VendorSignUpPage({ searchParams }: PageProps<"/vendor/sign-up">) {
  return <VendorAuthPage mode="signup" searchParams={await searchParams} />;
}
