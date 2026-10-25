"use client";

import { useRef, useState } from "react";

type Status = "idle" | "sending" | "sent";

export function AdvisorCta({ defaultName = "", defaultEmail = "" }: { defaultName?: string; defaultEmail?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: defaultName, email: defaultEmail, phone: "", message: "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const res = await fetch("/api/advisor-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    if (res?.ok) return setStatus("sent");
    const body = await res?.json().catch(() => null);
    setError(body?.error ?? "Something went wrong. Please try again.");
    setStatus("idle");
  }

  const input = "mt-1 block w-full rounded-xl border border-border bg-white px-3 py-2";

  return (
    <>
      <div className="mt-4 rounded-2xl bg-dark-gradient p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-coral">Wedding Advisor</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug">Let a wedding advisor find the perfect venue for you.</h2>
        <p className="mt-2 text-sm text-white/85">
          Connect with a real-life wedding advisor today and let us book you the perfect vendor or venue. Just $99 per category.
        </p>
        <button type="button" onClick={() => dialogRef.current?.showModal()} className="mt-4 w-full rounded-lg btn-coral px-6 py-3">
          Talk to an Advisor
        </button>
      </div>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        aria-labelledby="advisor-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/40"
      >
        <div className="relative p-6">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-accent-soft"
          >
            ✕
          </button>
          {status === "sent" ? (
            <div role="status" className="py-4 text-center">
              <h2 id="advisor-title" className="font-serif text-2xl font-semibold">Thank you{form.name ? `, ${form.name.split(" ")[0]}` : ""}!</h2>
              <p className="mt-2 text-muted">A Wedding Seeker advisor will reach out to schedule a meeting with you.</p>
              <button type="button" onClick={() => dialogRef.current?.close()} className="mt-5 rounded-full bg-foreground px-6 py-2 text-white">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <h2 id="advisor-title" className="pr-8 font-serif text-2xl font-semibold">Talk to a wedding advisor</h2>
              <p className="text-sm text-muted">Leave your contact details and we&apos;ll reach out to schedule a meeting with you.</p>
              <label className="block text-sm font-medium">
                Name
                <input required maxLength={200} autoComplete="name" value={form.name} onChange={set("name")} className={input} />
              </label>
              <label className="block text-sm font-medium">
                Email
                <input required type="email" maxLength={200} autoComplete="email" value={form.email} onChange={set("email")} className={input} />
              </label>
              <label className="block text-sm font-medium">
                Phone
                <input required type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={set("phone")} className={input} />
              </label>
              <label className="block text-sm font-medium">
                What are you looking for? <span className="font-normal text-muted">(optional)</span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.message}
                  onChange={set("message")}
                  placeholder="e.g. a beach venue in Tampa for 120 guests"
                  className={input}
                />
              </label>
              {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
              <button type="submit" disabled={status === "sending"} className="w-full rounded-lg btn-coral px-6 py-3 disabled:opacity-60">
                {status === "sending" ? "Sending…" : "Request a Meeting"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
