"use client";

import { useState } from "react";
import { CategoryPicker, SelectedTags } from "@/components/search-panel";
import { categoryLabel } from "@/lib/categories";
import { RADIUS_OPTIONS } from "@/lib/search-constants";
import { ANY_VENUE_TYPE, VENUE_TYPE_GROUPS, venueTypeLabel } from "@/lib/venue-types";
import { missingWeddingFields } from "@/lib/wedding-requirements";

type Profile = Record<string, unknown> & { venue_types?: string[]; vendors_needed?: string[] };

const BUDGETS = ["Under $10k", "$10k–$25k", "$25k–$50k", "$50k–$100k", "$100k+"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DEFAULT_RADIUS = 25;
const VENUE_OPTIONS = [ANY_VENUE_TYPE, ...VENUE_TYPE_GROUPS.map((g) => g.value)];

const FIELDS: { key: string; label: string; type?: string }[] = [
  { key: "partner1_name", label: "Your name" },
  { key: "partner2_name", label: "Partner's name" },
  { key: "contact_email", label: "Contact email", type: "email" },
  { key: "contact_phone", label: "Contact phone", type: "tel" },
];

/** Older profiles stored a month instead of free text; show it as text so it carries over. */
function withDateText(p: Profile): Profile {
  if (p.date_text || p.wedding_date || !p.target_month) return p;
  return { ...p, date_text: MONTHS[Number(p.target_month) - 1] ?? null };
}

export function WeddingForm({ initial, vendorCategories }: { initial: Profile; vendorCategories: string[] }) {
  const [profile, setProfile] = useState<Profile>(() => ({ ...withDateText(initial), radius_miles: initial.radius_miles ?? DEFAULT_RADIUS }));
  const [unsure, setUnsure] = useState(() => !initial.wedding_date && Boolean(initial.date_text || initial.target_month || initial.target_year));
  const [status, setStatus] = useState<string | null>(null);
  const missing = missingWeddingFields(profile);
  const set = (key: string, value: unknown) => setProfile((p) => ({ ...p, [key]: value === "" ? null : value }));
  const thisYear = new Date().getFullYear();
  const venueTypes = profile.venue_types ?? [];
  const vendors = profile.vendors_needed ?? [];

  function chooseUnsure(next: boolean) {
    setUnsure(next);
    setProfile((p) => (next ? { ...p, wedding_date: null } : { ...p, date_text: null, target_month: null, target_year: null }));
  }

  function toggleVenueType(value: string) {
    if (venueTypes.includes(value)) return set("venue_types", venueTypes.filter((v) => v !== value));
    set("venue_types", value === ANY_VENUE_TYPE ? [ANY_VENUE_TYPE] : [...venueTypes.filter((v) => v !== ANY_VENUE_TYPE), value]);
  }

  const toggleVendor = (value: string) =>
    set("vendors_needed", vendors.includes(value) ? vendors.filter((v) => v !== value) : [...vendors, value]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Saving…");
    const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
    const body = {
      ...profile,
      guest_count: num(profile.guest_count),
      target_month: unsure && !profile.date_text ? num(profile.target_month) : null,
      target_year: unsure ? num(profile.target_year) : null,
      radius_miles: num(profile.radius_miles),
      venue_types: venueTypes,
      vendors_needed: vendors,
    };
    const res = await fetch("/api/wedding", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setStatus(res?.ok ? (missing.length ? "Saved. A few details are still needed before you can connect." : "Saved. You're all set to connect with vendors!") : "Couldn't save. Check the fields and try again.");
  }

  const field = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm";
  const label = "mb-1 block text-sm font-medium";
  const req = <span className="text-coral" aria-hidden> *</span>;
  const toggle = "shrink-0 rounded-xl border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-soft";

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
            <input id={`w-${f.key}`} type={f.type ?? "text"} className={field} value={(profile[f.key] as string | null) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
          </div>
        ))}
        <div>
          <label htmlFor="w-location_text" className={label}>Location{req}</label>
          <input id="w-location_text" className={field} placeholder="City or ZIP" value={(profile.location_text as string | null) ?? ""} onChange={(e) => set("location_text", e.target.value)} />
        </div>
        <div>
          <label htmlFor="w-radius" className={label}>Radius</label>
          <select id="w-radius" className={field} value={(profile.radius_miles as number | null) ?? DEFAULT_RADIUS} onChange={(e) => set("radius_miles", Number(e.target.value))}>
            {RADIUS_OPTIONS.map((r) => <option key={r} value={r}>Within {r} miles</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="w-guest_count" className={label}>Guest count{req}</label>
          <input id="w-guest_count" type="number" min={1} className={field} value={(profile.guest_count as number | null) ?? ""} onChange={(e) => set("guest_count", e.target.value)} />
        </div>
        <div>
          <label htmlFor="w-budget" className={label}>Budget{req}</label>
          <select id="w-budget" className={field} value={(profile.budget_range as string) ?? ""} onChange={(e) => set("budget_range", e.target.value)}>
            <option value="">Choose a range</option>
            {BUDGETS.map((b) => <option key={b}>{b}</option>)}
            {profile.budget_range && !BUDGETS.includes(profile.budget_range as string) ? <option>{profile.budget_range as string}</option> : null}
          </select>
        </div>
        <div className="sm:col-span-2">
          {unsure ? (
            <>
              <span id="w-when-label" className={label}>When are you thinking?{req}</span>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input aria-labelledby="w-when-label" maxLength={100} placeholder="e.g. Spring, late October, a Saturday in June" className={field} value={(profile.date_text as string | null) ?? ""} onChange={(e) => set("date_text", e.target.value)} />
                <select aria-label="Wedding year" className={`${field} sm:w-32`} value={(profile.target_year as number | null) ?? ""} onChange={(e) => set("target_year", e.target.value)}>
                  <option value="">Year</option>
                  {Array.from({ length: 5 }, (_, i) => thisYear + i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button type="button" className={toggle} onClick={() => chooseUnsure(false)}>I know my exact date</button>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="w-wedding_date" className={label}>Exact wedding date{req}</label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input id="w-wedding_date" type="date" className={field} value={(profile.wedding_date as string) ?? ""} onChange={(e) => set("wedding_date", e.target.value)} />
                <button type="button" className={toggle} onClick={() => chooseUnsure(true)}>I do not know my exact date</button>
              </div>
            </>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="w-vibe" className={label}>Describe your wedding{req}</label>
          <p id="w-vibe-help" className="mb-1 text-sm text-muted">Please let the wedding vendor know as many details as possible about your event.</p>
          <textarea id="w-vibe" rows={4} maxLength={500} aria-describedby="w-vibe-help" className={field} value={(profile.vibe as string) ?? ""} onChange={(e) => set("vibe", e.target.value)} />
        </div>
        <div>
          <span id="w-venue-types" className={label}>Venue type</span>
          <CategoryPicker labelledBy="w-venue-types" options={VENUE_OPTIONS} selected={venueTypes} onToggle={toggleVenueType} labelOf={venueTypeLabel} noun="venue types" sortByLabel={false} placeholder="Choose venue types" />
          <SelectedTags label="Selected venue types" items={venueTypes} labelOf={venueTypeLabel} onRemove={toggleVenueType} />
        </div>
        <div>
          <span id="w-vendors" className={label}>Vendors you&apos;re looking for</span>
          <CategoryPicker labelledBy="w-vendors" options={vendorCategories} selected={vendors} onToggle={toggleVendor} labelOf={categoryLabel} noun="vendors" placeholder="Choose vendors" />
          <SelectedTags label="Selected vendors" items={vendors} labelOf={categoryLabel} onRemove={toggleVendor} />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className="rounded-full bg-accent px-6 py-2.5 font-medium text-white">Save</button>
          <p className="text-sm text-muted">{status}</p>
        </div>
      </div>
    </form>
  );
}
