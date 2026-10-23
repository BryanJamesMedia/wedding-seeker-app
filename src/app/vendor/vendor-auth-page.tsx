import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthStep } from "@/components/gate-modal";
import { getCurrentUser } from "@/lib/session";

type SearchParams = Record<string, string | string[] | undefined>;

function safeNext(value: string | string[] | undefined): string {
  const next = typeof value === "string" ? value : "/vendor";
  return next.startsWith("/vendor") ? next : "/vendor";
}

const COPY = {
  signin: {
    heading: "Sign in to your account",
    intro: "Manage your listings, connection requests and leads.",
  },
  signup: {
    heading: "Sign up for an account",
    intro: "Claim your listing, see couples who want to connect with you, and manage your leads.",
  },
};

export async function VendorAuthPage({ mode, searchParams }: { mode: "signin" | "signup"; searchParams: SearchParams }) {
  const next = safeNext(searchParams.next);
  const user = await getCurrentUser();
  if (user?.account_type === "vendor") redirect(next);
  const coupleAccount = searchParams.error === "couple_account" || user?.account_type === "couple";
  const otherPage = mode === "signin" ? "/vendor/sign-up" : "/vendor/sign-in";
  const switchHref = next === "/vendor" ? otherPage : `${otherPage}?next=${encodeURIComponent(next)}`;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <p className="text-center text-xl font-semibold uppercase tracking-wide text-accent sm:text-2xl">For venues and vendors</p>
      <h1 className="mt-3 text-center font-serif text-3xl font-semibold">{COPY[mode].heading}</h1>
      <p className="mt-2 text-center text-sm text-muted">{COPY[mode].intro}</p>
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
            reason={mode}
            inline
            vendor
            hideHeading
            switchHref={switchHref}
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
