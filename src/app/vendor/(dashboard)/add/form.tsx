"use client";

import Link from "next/link";
import { useState } from "react";

const field = "mt-1 w-full rounded-xl border border-border px-3 py-2";

type Duplicate = { listing_type: string; listing_id: string; name: string; city: string | null; state: string | null };

export function AddListingForm({
  categories,
  states,
  defaultEmail,
}: {
  categories: { value: string; label: string }[];
  states: [string, string][];
  defaultEmail: string;
}) {
  const [listingType, setListingType] = useState<"venue" | "vendor" | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [values, setValues] = useState<Record<string, FormDataEntryValue>>({});

  async function send(body: Record<string, unknown>) {
    setStatus("sending");
    setError(null);
    const res = await fetch("/api/vendor/listing-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDuplicates([]);
      setStatus("done");
      return;
    }
    setStatus("idle");
    if (res.status === 409 && Array.isArray(data.duplicates)) setDuplicates(data.duplicates);
    else setError(data.error ?? "Something went wrong. Please try again.");
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setValues(form);
    send({ ...form, listingType });
  }

  if (status === "done") {
    return (
      <p role="status" className="rounded-2xl bg-accent-soft p-4 text-sm">
        Thanks! Your request was sent. We&apos;ll review it and email {String(values.email ?? "you")} once it&apos;s live.
        You can see it under <Link href="/vendor" className="underline">Overview</Link> as &ldquo;Awaiting approval&rdquo;.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6">
      <fieldset>
        <legend className="text-sm font-medium">Is this a venue or a vendor? *</legend>
        <div className="mt-2 flex gap-2">
          {(["venue", "vendor"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={listingType === t}
              onClick={() => setListingType(t)}
              className={`rounded-full border px-5 py-2 text-sm ${listingType === t ? "border-foreground bg-foreground text-white" : "border-border"}`}
            >
              {t === "venue" ? "Venue" : "Vendor"}
            </button>
          ))}
        </div>
      </fieldset>
      {listingType ? (
        <>
          {listingType === "vendor" ? (
            <label className="block text-sm font-medium">
              Category *
              <select name="category" required defaultValue="" className={field}>
                <option value="" disabled>Choose a category</option>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium">{listingType === "venue" ? "Venue name" : "Business name"} *<input name="name" required maxLength={200} className={field} /></label>
          <label className="block text-sm font-medium">Street address<input name="address" maxLength={200} autoComplete="street-address" className={field} /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">City *<input name="city" required maxLength={100} className={field} /></label>
            <label className="block text-sm font-medium">
              State *
              <select name="state" required defaultValue="" className={field}>
                <option value="" disabled>Choose</option>
                {states.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">ZIP *<input name="zip" required inputMode="numeric" pattern="\d{5}(-\d{4})?" maxLength={10} className={field} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Phone *<input name="phone" type="tel" required maxLength={40} className={field} /></label>
            <label className="block text-sm font-medium">
              Listing email *
              <input name="email" type="email" required maxLength={200} defaultValue={defaultEmail} className={field} />
              <span className="mt-1 block text-xs font-normal text-muted">Connection requests and updates about this request go here.</span>
            </label>
          </div>
          <label className="block text-sm font-medium">Website<input name="website" maxLength={200} placeholder="example.com" className={field} /></label>
          <label className="block text-sm font-medium">Short description<textarea name="description" maxLength={2000} rows={4} className={field} /></label>
          {duplicates.length ? (
            <div role="alert" className="space-y-2 rounded-2xl bg-accent-soft p-4 text-sm">
              <p className="font-medium">This may already be listed. Is it one of these? Claim it instead:</p>
              <ul className="space-y-1">
                {duplicates.map((d) => (
                  <li key={`${d.listing_type}-${d.listing_id}`}>
                    <Link href={`/vendor/claim/${d.listing_type}/${d.listing_id}`} className="underline">
                      {d.name}
                    </Link>
                    {d.city ? ` · ${[d.city, d.state].filter(Boolean).join(", ")}` : null}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={status === "sending"}
                onClick={() => send({ ...values, listingType, force: true })}
                className="rounded-full border border-foreground px-5 py-2 disabled:opacity-60"
              >
                None of these. Request to Add anyway
              </button>
            </div>
          ) : null}
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          {duplicates.length ? null : (
            <button disabled={status === "sending"} className="rounded-full bg-foreground px-6 py-2 text-white disabled:opacity-60">
              {status === "sending" ? "Sending…" : "Request to Add"}
            </button>
          )}
        </>
      ) : null}
    </form>
  );
}
