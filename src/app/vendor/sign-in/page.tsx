import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthStep } from "@/components/gate-modal";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Vendor sign in", robots: { index: false } };

function safeNext(value: string | string[] | undefined): string {
  const next = typeof value === "string" ? value : "/vendor";
  return next.startsWith("/vendor") ? next : "/vendor";
}

export default async function VendorSignInPage({ searchParams }: PageProps<"/vendor/sign-in">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const user = await getCurrentUser();
  if (user?.account_type === "vendor") redirect(next);
  const coupleAccount = params.error === "couple_account" || user?.account_type === "couple";
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-accent">For venues and vendors</p>
      <h1 className="mt-1 text-center font-serif text-3xl font-semibold">Sign up or log in</h1>
      <p className="mt-2 text-center text-sm text-muted">
        Claim your listing, see couples who want to connect with you, and manage your leads.
      </p>
      {coupleAccount ? (
        <p role="alert" className="mt-4 rounded-2xl border border-border bg-accent-soft p-4 text-sm">
          {user ? <>You&apos;re signed in as <strong>{user.email}</strong>, which is a couple account. </> : "That email belongs to a couple account. "}
          Vendor accounts need a different email address.
          {user ? <> <Link href="/dashboard" className="text-accent underline">Go to your dashboard</Link></> : null}
        </p>
      ) : null}
      {user ? null : (
        <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <AuthStep
            reason="signup"
            inline
            vendor
            returnTo={next}
            googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
          />
        </div>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        Planning a wedding? <Link href="/sign-in" className="text-accent underline">Couples sign in here</Link>
      </p>
    </div>
  );
}
