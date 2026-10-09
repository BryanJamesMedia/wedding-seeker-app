import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getViewer } from "@/lib/session";
import { safeReturnPath } from "@/lib/utils";
import { UpgradeButton } from "@/components/upgrade-button";

export const metadata: Metadata = { title: "Upgrade", robots: { index: false } };

const PERKS = [
  "Phone, email, website and address for every listing",
  "Every match, not just the first 20",
  "Full photo galleries",
  "Save favorites to your dashboard",
  "One-click Connect: send your wedding details to vendors",
  "Track every vendor reply in one place",
];

export default async function UpgradePage({ searchParams }: PageProps<"/upgrade">) {
  const sp = await searchParams;
  const returnPath = safeReturnPath(typeof sp.return === "string" ? sp.return : null, "/dashboard");
  const viewer = await getViewer();
  if (!viewer.user) redirect(`/?signup=1&return=${encodeURIComponent(`/upgrade?return=${returnPath}`)}`);
  if (viewer.paid) redirect(returnPath);
  const continueUrl = `/auth/continue?return=${encodeURIComponent(returnPath)}`;
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="font-serif text-4xl font-semibold">Wedding Seeker Plus</h1>
        <p className="mt-2 text-muted">Everything you need to go from search to booked.</p>
        <ul className="mt-6 space-y-3">
          {PERKS.map((p) => (
            <li key={p} className="flex gap-2">
              <Check className="mt-0.5 size-5 shrink-0 text-sage" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <UpgradeButton continueUrl={continueUrl} />
        </div>
        <p className="mt-3 text-center text-sm text-muted">{process.env.NEXT_PUBLIC_PLAN_PRICE_LABEL ?? "Promo codes accepted at checkout."}</p>
      </div>
    </div>
  );
}
