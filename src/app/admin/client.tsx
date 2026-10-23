"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfigEditor({ label, configKey, initial }: { label: string; configKey: string; initial: unknown }) {
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));
  const [status, setStatus] = useState<string | null>(null);
  async function save() {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return setStatus("Not valid JSON");
    }
    const res = await fetch("/api/admin/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: configKey, value }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setStatus(res?.ok ? "Saved" : (body?.error ?? "Couldn't save"));
  }
  return (
    <details className="rounded-2xl border border-border bg-card p-4">
      <summary className="cursor-pointer font-medium">{label}</summary>
      <textarea aria-label={label} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(24, text.split("\n").length + 1)} className="mt-3 w-full rounded-xl border border-border bg-white p-3 font-mono text-xs" />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={save} className="rounded-full bg-accent px-4 py-2 text-sm text-white">Save</button>
        <p role="status" className="text-sm text-muted">{status}</p>
      </div>
    </details>
  );
}

export function ResolveButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/inbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
        router.refresh();
      }}
      className="rounded-full border border-border px-4 py-1.5 text-sm disabled:opacity-50"
    >
      Resolve
    </button>
  );
}

const toCents = (dollars: string) => Math.round(Number(dollars) * 100);

/** Adds (or, with a minus amount, removes) wallet credit as an "adjustment" transaction. */
export function CreditForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = toCents(amount);
    if (!Number.isFinite(cents) || cents === 0) return setStatus("Enter an amount, for example 25 or -5");
    if (!confirm(`${cents > 0 ? "Add" : "Remove"} $${Math.abs(cents / 100).toFixed(2)} ${cents > 0 ? "to" : "from"} this wallet?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, amountCents: cents, note }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string; balanceCents?: number } | null;
    setBusy(false);
    if (!res?.ok) return setStatus(body?.error ?? "Couldn't save");
    setStatus(`Saved. New balance: $${((body?.balanceCents ?? 0) / 100).toFixed(2)}`);
    setAmount("");
    setNote("");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-sm">
        Amount ($)
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00" className="mt-1 block w-32 rounded-xl border border-border px-3 py-2" />
      </label>
      <label className="min-w-64 flex-1 text-sm">
        Note (shown in the vendor&apos;s transactions)
        <input required maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Refund for duplicate lead" className="mt-1 block w-full rounded-xl border border-border px-3 py-2" />
      </label>
      <button type="submit" disabled={busy} className="rounded-full bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">Save credit</button>
      <p role="status" className="w-full text-sm text-muted">{status}</p>
    </form>
  );
}

export function PriceRow({ listingType, category, label, cents, fallbackCents, listings }: {
  listingType: "venue" | "vendor";
  category: string;
  label: string;
  cents: number | null;
  fallbackCents?: number;
  listings?: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(cents === null ? "" : (cents / 100).toFixed(2));
  const [status, setStatus] = useState<string | null>(null);
  async function save() {
    const priceCents = toCents(value);
    if (value.trim() === "" || !Number.isFinite(priceCents) || priceCents < 0) return setStatus("Enter a price");
    const res = await fetch("/api/admin/prices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingType, category, priceCents }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setStatus(res?.ok ? "Saved" : (body?.error ?? "Couldn't save"));
    if (res?.ok) router.refresh();
  }
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">{label}</td>
      <td className="px-3 py-2 text-muted">{listings ?? ""}</td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1">
          $<input
            aria-label={`Price for ${label}`}
            inputMode="decimal"
            value={value}
            onChange={(e) => { setValue(e.target.value); setStatus(null); }}
            placeholder={fallbackCents !== undefined ? (fallbackCents / 100).toFixed(2) : ""}
            className="w-24 rounded-xl border border-border px-3 py-1.5"
          />
        </span>
        {cents === null && fallbackCents !== undefined ? <span className="ml-2 text-xs text-muted">Uses default</span> : null}
      </td>
      <td className="px-3 py-2">
        <button type="button" onClick={save} className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent">Save</button>
        <span role="status" className="ml-2 text-sm text-muted">{status}</span>
      </td>
    </tr>
  );
}
