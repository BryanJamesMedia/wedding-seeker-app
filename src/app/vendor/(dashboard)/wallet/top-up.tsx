"use client";

import { useState } from "react";

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

export function TopUpButtons({ amounts }: { amounts: readonly number[] }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function topUp(amountCents: number) {
    setBusy(amountCents);
    setError(null);
    const res = await fetch("/api/vendor/wallet/top-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok && data?.url) {
      window.location.assign(data.url);
      return;
    }
    setBusy(null);
    setError(data?.error ?? "Couldn't start the payment. Please try again.");
  }

  return (
    <div>
      <p id="top-up-label" className="text-sm font-medium">Add funds</p>
      <div role="group" aria-labelledby="top-up-label" className="mt-2 flex flex-wrap gap-2">
        {amounts.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => topUp(a)}
            disabled={busy !== null}
            className="rounded-full btn-coral px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy === a ? "Opening checkout…" : `Add ${dollars(a)}`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Secure payment by Stripe. Wallet credit is used to purchase connections and isn&apos;t refundable.</p>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
