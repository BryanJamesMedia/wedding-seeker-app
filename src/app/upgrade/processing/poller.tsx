"use client";

import { useEffect, useState } from "react";

/** Polls until the Stripe webhook has marked the account paid, then resumes the pending action. */
export function ProcessingPoller({ returnTo }: { returnTo: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    let tries = 0;
    let stopped = false;
    async function tick() {
      if (stopped) return;
      tries++;
      const res = await fetch("/api/me", { cache: "no-store" }).catch(() => null);
      const me = (await res?.json().catch(() => null)) as { paid?: boolean } | null;
      if (me?.paid) return window.location.replace(returnTo);
      if (tries > 10) setSlow(true);
      setTimeout(tick, tries < 10 ? 1500 : 4000);
    }
    tick();
    return () => {
      stopped = true;
    };
  }, [returnTo]);
  return slow ? (
    <p className="mt-6 text-sm text-muted">
      Still waiting on the payment provider. If this doesn&apos;t finish in a minute, email{" "}
      <a className="underline" href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@weddingseeker.com"}`}>support</a>.
    </p>
  ) : (
    <div className="mx-auto mt-8 size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
  );
}
