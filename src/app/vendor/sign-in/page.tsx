import { VendorAuthPage } from "../vendor-auth-page";

export const metadata = { title: "Vendor sign in", robots: { index: false } };

export default async function VendorSignInPage({ searchParams }: PageProps<"/vendor/sign-in">) {
  return <VendorAuthPage mode="signin" searchParams={await searchParams} />;
}
