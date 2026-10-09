"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

type Profile = {
  partner1_name?: string | null;
  partner2_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  wedding_date?: string | null;
  location_text?: string | null;
  guest_count?: number | null;
  budget_range?: string | null;
  settings?: string[];
  vibe?: string | null;
};

const BUDGETS = ["Under $10k", "$10k–$25k", "$25k–$50k", "$50k–$100k", "$100k+"];
const SETTINGS = ["Beach", "Garden", "Ballroom", "Barn", "Waterfront", "Estate", "Rooftop", "Intimate"];

/** Opened by ?connect=venue:123 so it survives sign-up and checkout redirects. */
export function ConnectModalHost() {
  const params = useSearchParams();
  const target = params.get("connect");
  if (!target) return null;
  const [listingType, listingId] = target.split(":");
  if ((listingType !== "venue" && listingType !== "vendor") || !listingId) return null;
  return <ConnectModal key={target} listingType={listingType} listingId={listingId} />;
}

function ConnectModal({ listingType, listingId }: { listingType: "venue" | "vendor"; listingId: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [profile, setProfile] = useState<Profile>({});
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"loading" | "form" | "sending" | "done">("loading");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    fetch("/api/wedding")
      .then((r) => r.json())
      .then((d: { profile: Profile | null; email: string }) => {
        setProfile({ contact_email: d.email, ...(d.profile ?? {}) });
        setState("form");
      })
      .catch(() => setState("form"));
  }, []);

  function close() {
    ref.current?.close();
    const next = new URLSearchParams(params);
    next.delete("connect");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const res = await fetch("/api/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingType, listingId, message, profile }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { status?: string; error?: string } | null;
    if (!res?.ok) {
      setError(data?.error ?? "Something went wrong. Please try again.");
      return setState("form");
    }
    setResult(data?.status === "pending_outreach" ? "We'll reach out to them for you and update your dashboard when they reply." : "Sent! We'll email you when they respond.");
    setState("done");
  }

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile((p) => ({ ...p, [k]: v }));
  const field = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm";
  const label = "mb-1 block text-sm font-medium";

  return (
    <dialog ref={ref} onClose={close} aria-labelledby="connect-title" className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-2xl bg-card p-0 backdrop:bg-black/40">
      <div className="max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between">
          <h2 id="connect-title" className="font-serif text-2xl font-semibold">Send your wedding details</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded-full p-1 hover:bg-accent-soft">
            <X className="size-5" />
          </button>
        </div>
        {state === "loading" ? (
          <p className="py-10 text-center text-muted">Loading…</p>
        ) : state === "done" ? (
          <div className="py-8 text-center">
            <p className="text-lg">{result}</p>
            <button type="button" onClick={close} className="mt-6 rounded-full bg-accent px-6 py-2.5 text-white">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className={label} htmlFor="c-p1">Your name</label><input id="c-p1" required className={field} value={profile.partner1_name ?? ""} onChange={(e) => set("partner1_name", e.target.value)} /></div>
            <div><label className={label} htmlFor="c-p2">Partner&apos;s name</label><input id="c-p2" className={field} value={profile.partner2_name ?? ""} onChange={(e) => set("partner2_name", e.target.value)} /></div>
            <div><label className={label} htmlFor="c-em">Email</label><input id="c-em" type="email" required className={field} value={profile.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} /></div>
            <div><label className={label} htmlFor="c-ph">Phone (optional)</label><input id="c-ph" type="tel" className={field} value={profile.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} /></div>
            <div><label className={label} htmlFor="c-dt">Wedding date</label><input id="c-dt" type="date" className={field} value={profile.wedding_date ?? ""} onChange={(e) => set("wedding_date", e.target.value)} /></div>
            <div><label className={label} htmlFor="c-gc">Guests</label><input id="c-gc" inputMode="numeric" className={field} value={profile.guest_count ?? ""} onChange={(e) => set("guest_count", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} /></div>
            <div><label className={label} htmlFor="c-loc">Location</label><input id="c-loc" className={field} value={profile.location_text ?? ""} onChange={(e) => set("location_text", e.target.value)} /></div>
            <div>
              <label className={label} htmlFor="c-bd">Budget</label>
              <select id="c-bd" className={field} value={profile.budget_range ?? ""} onChange={(e) => set("budget_range", e.target.value || null)}>
                <option value="">Prefer not to say</option>
                {BUDGETS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <fieldset className="sm:col-span-2">
              <legend className={label}>Setting</legend>
              <div className="flex flex-wrap gap-1.5">
                {SETTINGS.map((s) => {
                  const on = profile.settings?.includes(s) ?? false;
                  return (
                    <button key={s} type="button" aria-pressed={on} onClick={() => set("settings", on ? profile.settings!.filter((x) => x !== s) : [...(profile.settings ?? []), s])} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-sage bg-sage text-white" : "border-border bg-white"}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="sm:col-span-2"><label className={label} htmlFor="c-msg">Message (optional)</label><textarea id="c-msg" rows={3} maxLength={2000} className={field} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything they should know?" /></div>
            {error ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
            <p className="text-xs text-muted sm:col-span-2">Your email and phone are only shared if the vendor says they&apos;re interested.</p>
            <button type="submit" disabled={state === "sending"} className="rounded-lg btn-coral px-6 py-3 sm:col-span-2 disabled:opacity-60">
              {state === "sending" ? "Sending…" : "Send request"}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
