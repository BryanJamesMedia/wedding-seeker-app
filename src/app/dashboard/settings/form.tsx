"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Prefs = { email_connect_confirmations: boolean; email_saved_search_alerts: boolean; marketing_opt_in: boolean };

const LABELS: Record<keyof Prefs, string> = {
  email_connect_confirmations: "Email me when a vendor responds",
  email_saved_search_alerts: "Weekly alerts for saved searches",
  marketing_opt_in: "Wedding tips and offers",
};

export function SettingsForm({ initial }: { initial: Prefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function update(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const res = await fetch("/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    setStatus(res?.ok ? "Saved" : "Couldn't save");
  }

  async function remove() {
    const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      router.push("/");
      router.refresh();
    }
    else setStatus("Couldn't delete your account. Please contact support.");
  }

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-2xl font-semibold">Email preferences</h2>
        <div className="mt-3 space-y-2">
          {(Object.keys(LABELS) as (keyof Prefs)[]).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={prefs[k]} onChange={(e) => update(k, e.target.checked)} />
              {LABELS[k]}
            </label>
          ))}
        </div>
        <p role="status" className="mt-2 text-xs text-muted">{status}</p>
      </section>
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
        <h2 className="font-serif text-2xl font-semibold">Delete account</h2>
        <p className="mt-1 text-sm text-muted">Removes your profile, saves and searches. Vendors you contacted keep a record without your details. Type DELETE to confirm.</p>
        <div className="mt-3 flex gap-2">
          <input aria-label="Type DELETE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" />
          <button type="button" disabled={confirm !== "DELETE"} onClick={remove} className="rounded-full bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-40">Delete</button>
        </div>
      </section>
    </>
  );
}
