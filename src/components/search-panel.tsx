"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { FilterDef } from "@/lib/config-defaults";

const PLACEHOLDERS = [
  "Relaxed boho beach ceremony for about 60 guests, sunset, nothing too formal",
  "Classic ballroom with chandeliers for 200 guests, black tie",
  "Rustic barn with string lights and farm tables, about 120 guests",
  "Photographer with a light, airy style who is great with candid moments",
];

export type SearchPanelValues = {
  categories: string[];
  location: string;
  radius: number;
  description: string;
  filters: Record<string, string | string[]>;
};

export function SearchPanel({
  categories,
  filters,
  initial,
  compact = false,
}: {
  categories: { category: string; listingType: "venue" | "vendor" }[];
  filters: FilterDef[];
  initial: SearchPanelValues;
  compact?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState(initial);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [placeholder, setPlaceholder] = useState(0);
  const [showFilters, setShowFilters] = useState(Object.keys(initial.filters).length > 0);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPlaceholder((p) => (p + 1) % PLACEHOLDERS.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const text = values.location.trim();
    if (text.length < 2 || /^-?\d+\.\d+,/.test(text)) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/locations?q=${encodeURIComponent(text)}`, { signal: controller.signal }).catch(() => null);
      if (res?.ok) setSuggestions(((await res.json()) as { suggestions: string[] }).suggestions);
    }, 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [values.location]);

  const lowered = values.categories.map((c) => c.toLowerCase());
  const visibleFilters = filters.filter(
    (f) => f.categories.length === 0 || lowered.length === 0 || f.categories.some((c) => lowered.some((x) => x.includes(c))),
  );

  function setFilter(key: string, value: string | string[] | null) {
    setValues((v) => {
      const next = { ...v.filters };
      if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) delete next[key];
      else next[key] = value;
      return { ...v, filters: next };
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (values.categories.length === 0) return setError("Choose what you're looking for.");
    if (!values.location.trim()) return setError("Enter a city or ZIP code.");
    setError(null);
    const qs = new URLSearchParams();
    for (const c of values.categories) qs.append("category", c);
    qs.set("location", values.location.trim());
    qs.set("radius", String(values.radius));
    if (values.description.trim()) qs.set("q", values.description.trim());
    for (const f of visibleFilters) {
      const v = values.filters[f.key];
      if (v != null && v !== "") qs.set(`f_${f.key}`, Array.isArray(v) ? v.join(",") : v);
    }
    router.push(`/search?${qs}`);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Location isn't available in this browser.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setValues((v) => ({ ...v, location: `${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}` }));
      },
      () => {
        setLocating(false);
        setError("We couldn't get your location. Type a city or ZIP instead.");
      },
    );
  }

  const field = "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm";
  const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted";
  const venues = categories.filter((c) => c.listingType === "venue");
  const vendors = categories.filter((c) => c.listingType === "vendor");

  return (
    <form onSubmit={submit} className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${compact ? "" : "sm:p-6"}`} aria-label="Search">
      <fieldset>
        <legend className={label}>What are you looking for</legend>
        <div className="flex flex-wrap gap-2">
          {[...venues, ...vendors].map((c) => {
            const active = values.categories.includes(c.category);
            return (
              <button
                key={c.category}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    categories: active ? v.categories.filter((x) => x !== c.category) : [...v.categories, c.category],
                  }))
                }
                className={`rounded-full border px-3 py-1.5 text-sm ${active ? "border-accent bg-accent text-white" : "border-border bg-white hover:border-accent"}`}
              >
                {c.category === "Venue" ? "Venues" : c.category}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className={`mt-4 grid gap-3 ${compact ? "" : "sm:grid-cols-[1fr_140px]"}`}>
        <div className="relative">
          <label htmlFor={`${id}-loc`} className={label}>Location</label>
          <input
            id={`${id}-loc`}
            list={`${id}-loc-list`}
            value={values.location}
            onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
            placeholder="City or ZIP"
            autoComplete="off"
            className={field}
          />
          <datalist id={`${id}-loc-list`}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button type="button" onClick={useMyLocation} className="mt-1 text-xs text-accent underline underline-offset-2">
            {locating ? "Locating…" : "Use my location"}
          </button>
        </div>
        <div>
          <label htmlFor={`${id}-radius`} className={label}>Radius</label>
          <select
            id={`${id}-radius`}
            value={values.radius}
            onChange={(e) => setValues((v) => ({ ...v, radius: Number(e.target.value) }))}
            className={field}
          >
            {[10, 25, 50, 100].map((r) => (
              <option key={r} value={r}>{r} miles</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor={`${id}-q`} className={label}>Describe what you want</label>
        <textarea
          id={`${id}-q`}
          value={values.description}
          maxLength={500}
          rows={compact ? 3 : 2}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          placeholder={PLACEHOLDERS[placeholder]}
          className={`${field} resize-none`}
        />
        <p className="mt-1 text-right text-xs text-muted">{values.description.length}/500</p>
      </div>

      <button
        type="button"
        onClick={() => setShowFilters((s) => !s)}
        aria-expanded={showFilters}
        className="text-sm font-medium text-accent"
      >
        {showFilters ? "Hide filters" : "More filters"}
      </button>
      {showFilters ? (
        <div className={`mt-3 grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
          {visibleFilters.map((f) => (
            <FilterControl key={f.key} def={f} value={values.filters[f.key]} onChange={(v) => setFilter(f.key, v)} categories={lowered} />
          ))}
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button type="submit" className="mt-4 w-full rounded-full bg-accent px-6 py-3 font-medium text-white hover:bg-accent-strong">
        Search
      </button>
    </form>
  );
}

function FilterControl({
  def,
  value,
  onChange,
  categories,
}: {
  def: FilterDef;
  value: string | string[] | undefined;
  onChange: (v: string | string[] | null) => void;
  categories: string[];
}) {
  const id = useId();
  const field = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm";
  const unit =
    Object.entries(def.unitByCategory ?? {}).find(([k]) => categories.length === 1 && categories[0].includes(k))?.[1] ?? def.unit;
  if (def.input === "toggle") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value === "1"} onChange={(e) => onChange(e.target.checked ? "1" : null)} className="size-4 accent-[var(--accent)]" />
        {def.label}
      </label>
    );
  }
  if (def.input === "multiselect") {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{def.label}</legend>
        <div className="flex flex-wrap gap-1.5">
          {def.options?.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((s) => s !== o.value) : [...selected, o.value])}
                className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-sage bg-sage text-white" : "border-border bg-white"}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }
  if (def.input === "select") {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium">{def.label}</label>
        <select id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} className={field}>
          <option value="">Any</option>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }
  if (def.input === "range") {
    const [min = "", max = ""] = typeof value === "string" ? value.split("-") : [];
    const set = (a: string, b: string) => onChange(a || b ? `${a}-${b}` : null);
    return (
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{def.label} {unit ? <span className="text-muted">({unit})</span> : null}</legend>
        <div className="flex gap-2">
          <input aria-label={`${def.label} minimum`} inputMode="numeric" placeholder="Min" value={min} onChange={(e) => set(e.target.value.replace(/\D/g, ""), max)} className={field} />
          <input aria-label={`${def.label} maximum`} inputMode="numeric" placeholder="Max" value={max} onChange={(e) => set(min, e.target.value.replace(/\D/g, ""))} className={field} />
        </div>
      </fieldset>
    );
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{def.label} {unit ? <span className="text-muted">({unit})</span> : null}</label>
      <input id={id} inputMode="numeric" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value.replace(/\D/g, "") || null)} className={field} />
    </div>
  );
}
