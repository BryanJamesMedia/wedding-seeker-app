"use client";

import { useState } from "react";

export function ClaimForm({ listingType, listingId, defaultName, resubmit }: { listingType: string; listingId: string; defaultName: string; resubmit: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("sending");
    setError(null);
    const res = await fetch("/api/vendor/claims", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingType, listingId, ...Object.fromEntries(form) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setStatus("done");
    else {
      setStatus("idle");
      setError(data.error ?? "Something went wrong. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <p role="status" className="rounded-2xl bg-accent-soft p-4 text-sm">
        Thanks! Your claim was sent. We review every claim by hand, usually within 1–2 business days, and you can edit the listing once it&apos;s approved.
      </p>
    );
  }
  const field = "mt-1 w-full rounded-xl border border-border px-3 py-2";
  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6">
      {resubmit ? <p className="text-sm text-muted">Your earlier claim wasn&apos;t approved. You can send it again with more details.</p> : null}
      <label className="block text-sm font-medium">Your name *<input name="claimantName" required maxLength={200} defaultValue={defaultName} className={field} /></label>
      <label className="block text-sm font-medium">Your role at the business *<input name="claimantRole" required maxLength={200} placeholder="Owner, manager, event coordinator…" className={field} /></label>
      <label className="block text-sm font-medium">Phone number *<input name="claimantPhone" type="tel" required maxLength={40} className={field} /></label>
      <label className="block text-sm font-medium">
        Anything that helps us verify you (optional)
        <textarea name="note" maxLength={1000} rows={3} placeholder="For example, your business email domain or a link that shows you work there." className={field} />
      </label>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <button disabled={status === "sending"} className="rounded-full bg-foreground px-6 py-2 text-white disabled:opacity-60">
        {status === "sending" ? "Sending…" : "Claim this listing"}
      </button>
    </form>
  );
}
