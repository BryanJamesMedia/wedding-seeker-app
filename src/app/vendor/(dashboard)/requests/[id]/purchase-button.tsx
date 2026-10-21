"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PurchaseButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function purchase() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/vendor/leads/purchase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push(`/vendor/leads/${requestId}`);
      router.refresh();
      return;
    }
    setBusy(false);
    setError(data.error ?? "Something went wrong. Please try again.");
  }

  return (
    <div className="space-y-2">
      <button onClick={purchase} disabled={busy} className="btn-coral rounded-full px-6 py-2.5 font-medium text-white disabled:opacity-60">
        {busy ? "Purchasing…" : "Purchase Connection"}
      </button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
