"use client";

import { useState } from "react";

export function UpgradeButton({ continueUrl, label = "Upgrade to Plus" }: { continueUrl: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ continueUrl }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (data?.url) return window.location.assign(data.url);
    setError(data?.error ?? "Something went wrong. Please try again.");
    setLoading(false);
  }
  return (
    <div>
      <button type="button" onClick={go} disabled={loading} className="w-full rounded-full bg-accent px-6 py-3 font-medium text-white hover:bg-accent-strong disabled:opacity-60">
        {loading ? "Opening checkout…" : label}
      </button>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
