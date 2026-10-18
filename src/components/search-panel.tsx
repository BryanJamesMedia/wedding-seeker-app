"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import type { FilterDef } from "@/lib/config-defaults";
import { categoryLabel, LISTING_TYPES, type ListingType } from "@/lib/categories";

const PLACEHOLDERS = [
  "Relaxed boho beach ceremony for about 60 guests, sunset, nothing too formal",
  "Classic ballroom with chandeliers for 200 guests, black tie",
  "Rustic barn with string lights and farm tables, about 120 guests",
  "Photographer with a light, airy style who is great with candid moments",
];

export type SearchPanelValues = {
  listingType: ListingType | null;
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
  categories: { category: string; listingType: ListingType }[];
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
    if (!values.listingType) return setError("Choose venues or vendors.");
    if (!values.location.trim()) return setError("Enter a city or ZIP code.");
    setError(null);
    const qs = new URLSearchParams();
    qs.set("type", values.listingType);
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
  const typeCategories = categories.filter((c) => c.listingType === values.listingType).map((c) => c.category);
  const toggleCategory = (category: string) =>
    setValues((v) => ({
      ...v,
      categories: v.categories.includes(category) ? v.categories.filter((x) => x !== category) : [...v.categories, category],
    }));

  return (
    <form onSubmit={submit} className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${compact ? "" : "sm:p-6"}`} aria-label="Search">
      <fieldset>
        <legend className={label}>Search for</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-accent-soft p-1">
          {LISTING_TYPES.map((t) => {
            const on = values.listingType === t.value;
            return (
              <label
                key={t.value}
                className={`cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${on ? "bg-white text-accent shadow-sm ring-1 ring-accent" : "text-foreground hover:bg-white/60"}`}
              >
                <input
                  type="radio"
                  name={`${id}-type`}
                  value={t.value}
                  checked={on}
                  onChange={() => setValues((v) => ({ ...v, listingType: t.value, categories: v.listingType === t.value ? v.categories : [] }))}
                  className="sr-only"
                />
                {t.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {values.listingType && typeCategories.length > 1 ? (
        <div className="mt-4">
          <span id={`${id}-cat-label`} className={label}>Categories</span>
          <CategoryPicker labelledBy={`${id}-cat-label`} options={typeCategories} selected={values.categories} onToggle={toggleCategory} />
          {values.categories.length > 0 ? (
            <ul aria-label="Selected categories" className="mt-2 flex flex-wrap gap-2">
              {values.categories.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(c)}
                    aria-label={`Remove ${categoryLabel(c)}`}
                    className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent py-1.5 pl-3 pr-2 text-sm text-white hover:bg-accent-strong"
                  >
                    {categoryLabel(c)}
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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
      <button type="submit" className="mt-4 w-full rounded-lg btn-coral px-6 py-3">
        Search
      </button>
    </form>
  );
}

function CategoryPicker({
  labelledBy,
  options,
  selected,
  onToggle,
}: {
  labelledBy: string;
  options: string[];
  selected: string[];
  onToggle: (category: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sorted = [...options].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  const shown = sorted.filter((o) => categoryLabel(o).toLowerCase().includes(filter.trim().toLowerCase()));
  const summary =
    selected.length === 0 ? "All categories" : selected.length === 1 ? categoryLabel(selected[0]) : `${selected.length} categories selected`;

  return (
    <div ref={ref} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-labelledby={labelledBy}
        aria-describedby={`${labelledBy}-summary`}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-left text-sm hover:border-accent"
      >
        <span id={`${labelledBy}-summary`} className={selected.length ? "text-foreground" : "text-muted"}>{summary}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          {options.length > 8 ? (
            <div className="border-b border-border p-2">
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Type to filter…"
                aria-label="Filter categories"
                className="w-full rounded-lg border border-border px-2.5 py-1.5 text-sm"
              />
            </div>
          ) : null}
          <div role="group" aria-labelledby={labelledBy} className="max-h-64 overflow-y-auto py-1">
            {shown.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent-soft">
                <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} className="size-4 accent-[var(--accent)]" />
                {categoryLabel(o)}
              </label>
            ))}
            {shown.length === 0 ? <p className="px-3 py-2 text-sm text-muted">No matching categories</p> : null}
          </div>
        </div>
      ) : null}
    </div>
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
