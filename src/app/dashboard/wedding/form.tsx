"use client";

import { useState } from "react";
import { missingWeddingFields } from "@/lib/wedding-requirements";

type Profile = Record<string, unknown> & { settings?: string[] };

const BUDGETS = ["Under $10k", "$10k–$25k", "$25k–$50k", "$50k–$100k", "$100k+"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const FIELDS: { key: string; label: string; type?: string }[] = [
  { key: "partner1_name", label: "Your name" },
  { key: "partner2_name", label: "Partner's name" },
  { key: "contact_email", label: "Contact email", type: "email" },
  { key: "contact_phone", label: "Contact phone", type: "tel" },
  { key: "location_text", label: "Location" },
  { key: "guest_count", label: "Guest count", type: "number" },
];

export function WeddingForm({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState<Profile>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const missing = missingWeddingFields(profile);
  const set = (key: string, value: unknown) => setProfile((p) => ({ ...p, [key]: value === "" ? null : value }));
  const thisYear = new Date().getFullYear();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Saving…");
    const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
    const body = { ...profile, guest_count: num(profile.guest_count), target_month: num(profile.target_month), target_year: num(profile.target_year) };
    const res = await fetch("/api/wedding", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setStatus(res?.ok ? (missing.length ? "Saved. A few details are still needed before you can connect." : "Saved. You're all set to connect with vendors!") : "Couldn't save. Check the fields and try again.");
  }

  const field = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm";
  const label = "mb-1 block text-sm font-medium";
  const req = <span className="text-coral" aria-hidden> *</span>;

  return (
    <form onSubmit={save} className="mt-6 max-w-2xl">
      <div role="status" className={`mb-6 rounded-xl p-4 text-sm ${missing.length ? "bg-accent-soft" : "bg-emerald-50 text-emerald-900"}`}>
        {missing.length ? (
          <>
            <p className="font-semibold">Fill out the fields marked * to connect with vendors.</p>
            <p className="mt-1 text-muted">Still needed: {missing.join(", ")}</p>
          </>
        ) : (
          <p className="font-semibold">Your wedding details are complete. You can connect with vendors.</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`w-${f.key}`} className={label}>{f.label}{req}</label>
            <input id={`w-${f.key}`} type={f.type ?? "text"} min={f.type === "number" ? 1 : undefined} className={field} value={(profile[f.key] as string | number | null) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
          </div>
        ))}
        <div>
          <label htmlFor="w-budget" className={label}>Budget{req}</label>
          <select id="w-budget" className={field} value={(profile.budget_range as string) ?? ""} onChange={(e) => set("budget_range", e.target.value)}>
            <option value="">Choose a range</option>
            {BUDGETS.map((b) => <option key={b}>{b}</option>)}
            {profile.budget_range && !BUDGETS.includes(profile.budget_range as string) ? <option>{profile.budget_range as string}</option> : null}
          </select>
        </div>
        <div>
          <label htmlFor="w-wedding_date" className={label}>Wedding date{req}</label>
          <input id="w-wedding_date" type="date" className={field} value={(profile.wedding_date as string) ?? ""} onChange={(e) => set("wedding_date", e.target.value)} />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm text-muted">Not sure of the exact date? Choose a month and year instead.</legend>
          <div className="grid grid-cols-2 gap-4">
            <select aria-label="Wedding month" className={field} value={(profile.target_month as number | null) ?? ""} onChange={(e) => set("target_month", e.target.value)}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select aria-label="Wedding year" className={field} value={(profile.target_year as number | null) ?? ""} onChange={(e) => set("target_year", e.target.value)}>
              <option value="">Year</option>
              {Array.from({ length: 5 }, (_, i) => thisYear + i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <label htmlFor="w-vibe" className={label}>Describe your wedding <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="w-vibe" rows={3} maxLength={500} className={field} value={(profile.vibe as string) ?? ""} onChange={(e) => set("vibe", e.target.value)} />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className="rounded-full bg-accent px-6 py-2.5 font-medium text-white">Save</button>
          <p className="text-sm text-muted">{status}</p>
        </div>
      </div>
    </form>
  );
}
