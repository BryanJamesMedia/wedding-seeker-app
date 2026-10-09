import type { Metadata } from "next";
import { ProcessingPoller } from "./poller";

export const metadata: Metadata = { title: "Finishing up", robots: { index: false } };

export default async function ProcessingPage({ searchParams }: PageProps<"/upgrade/processing">) {
  const sp = await searchParams;
  const ret = typeof sp.return === "string" && sp.return.startsWith("/") && !sp.return.startsWith("//") ? sp.return : "/dashboard";
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-serif text-3xl font-semibold">Confirming your payment…</h1>
      <p className="mt-2 text-muted">This usually takes a few seconds. Please don&apos;t close this page.</p>
      <ProcessingPoller returnTo={ret.replace(/([?&])checkout=success&?/, "$1").replace(/[?&]$/, "")} />
    </div>
  );
}
