"use client";

import { useState } from "react";

type Field = { key: string; label: string; kind: string; group: string; options?: { value: string; label: string }[] };

export function EditListingForm({ listingType, listingId, fields, values, fallbackEmail, endpoint = "/api/vendor/listings" }: {
  listingType: string;
  listingId: string;
  fields: Field[];
  values: Record<string, string>;
  fallbackEmail: string | null;
  endpoint?: string;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const groups = [...new Set(fields.map((f) => f.group))];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    const res = await fetch(endpoint, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingType, listingId, values: Object.fromEntries(new FormData(e.currentTarget)) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setStatus("saved");
    else {
      setStatus("idle");
      setError(data.error ?? "Could not save. Please try again.");
    }
  }

  const input = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";
  return (
    <form onSubmit={submit} onChange={() => status === "saved" && setStatus("idle")} className="space-y-6">
      {groups.map((group) => (
        <fieldset key={group} className="space-y-4 rounded-3xl border border-border bg-card p-6">
          <legend className="px-1 text-lg font-semibold">{group}</legend>
          {fields.filter((f) => f.group === group).map((f) => (
            <label key={f.key} className="block text-sm font-medium">
              {f.label}
              {f.kind === "select" ? (
                <select name={f.key} defaultValue={values[f.key]} className={input}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.kind === "textarea" || f.kind === "list" ? (
                <textarea name={f.key} defaultValue={values[f.key]} rows={f.kind === "list" ? 4 : f.key === "description" ? 8 : 3} className={input} />
              ) : (
                <input
                  name={f.key}
                  required={f.key === "name"}
                  defaultValue={values[f.key]}
                  type={f.kind === "email" ? "email" : f.kind === "number" ? "number" : "text"}
                  min={f.kind === "number" ? 0 : undefined}
                  step={f.kind === "number" ? "any" : undefined}
                  placeholder={f.key === "connect_email" && fallbackEmail ? fallbackEmail : undefined}
                  className={input}
                />
              )}
              {f.key === "connect_email" ? (
                <span className="mt-1 block text-xs font-normal text-muted">Connection request notifications go to this email.</span>
              ) : null}
            </label>
          ))}
        </fieldset>
      ))}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button disabled={status === "saving"} className="rounded-full bg-foreground px-6 py-2 text-white disabled:opacity-60">
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" ? <span role="status" className="text-sm text-accent">Saved</span> : null}
      </div>
    </form>
  );
}
