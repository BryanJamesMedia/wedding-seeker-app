"use client";

import { useState } from "react";

type Profile = Record<string, unknown> & { settings?: string[] };

const FIELDS: { key: string; label: string; type?: string }[] = [
  { key: "partner1_name", label: "Your name" },
  { key: "partner2_name", label: "Partner's name" },
  { key: "contact_email", label: "Contact email", type: "email" },
  { key: "contact_phone", label: "Contact phone", type: "tel" },
  { key: "wedding_date", label: "Wedding date", type: "date" },
  { key: "location_text", label: "Location" },
  { key: "guest_count", label: "Guest count", type: "number" },
  { key: "budget_range", label: "Budget" },
];

export function WeddingForm({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState<Profile>(initial);
  const [status, setStatus] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Saving…");
    const body = { ...profile, guest_count: profile.guest_count ? Number(profile.guest_count) : null };
    const res = await fetch("/api/wedding", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setStatus(res?.ok ? "Saved" : "Couldn't save. Check the fields and try again.");
  }
  const field = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm";
  return (
    <form onSubmit={save} className="mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={`w-${f.key}`} className="mb-1 block text-sm font-medium">{f.label}</label>
          <input id={`w-${f.key}`} type={f.type ?? "text"} className={field} value={(profile[f.key] as string | number | null) ?? ""} onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))} />
        </div>
      ))}
      <div className="sm:col-span-2">
        <label htmlFor="w-vibe" className="mb-1 block text-sm font-medium">Describe your wedding</label>
        <textarea id="w-vibe" rows={3} maxLength={500} className={field} value={(profile.vibe as string) ?? ""} onChange={(e) => setProfile((p) => ({ ...p, vibe: e.target.value }))} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className="rounded-full bg-accent px-6 py-2.5 font-medium text-white">Save</button>
        <p role="status" className="text-sm text-muted">{status}</p>
      </div>
    </form>
  );
}
