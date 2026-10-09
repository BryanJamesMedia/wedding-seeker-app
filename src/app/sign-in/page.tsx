import { redirect } from "next/navigation";
import { AuthStep } from "@/components/gate-modal";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Sign in", robots: { index: false } };

function safeNext(value: string | string[] | undefined): string {
  const next = typeof value === "string" ? value : "/dashboard";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <AuthStep
          reason="signup"
          inline
          returnTo={next}
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        />
      </div>
    </div>
  );
}
