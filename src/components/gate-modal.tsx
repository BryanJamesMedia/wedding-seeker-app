"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { signIn } from "@/lib/auth-client";

export type PendingAction =
  | { kind: "save"; listingType: "venue" | "vendor"; listingId: string; name: string }
  | { kind: "connect"; listingType: "venue" | "vendor"; listingId: string; name: string };

type ModalState =
  | { mode: "auth"; reason: "signup" | "save" | "connect"; action?: PendingAction }
  | { mode: "upgrade"; action?: PendingAction }
  | null;

let state: ModalState = null;
const listeners = new Set<() => void>();
function setState(next: ModalState) {
  state = next;
  for (const l of listeners) l();
}

export function openAuthModal(args: { reason: "signup" | "save" | "connect"; action?: PendingAction }) {
  setState({ mode: "auth", ...args });
}

export function openUpgradeModal(action?: PendingAction) {
  setState({ mode: "upgrade", action });
}

/** Where the couple returns after sign-up + checkout, with the pending action completed. */
function continueUrl(action?: PendingAction): string {
  const params = new URLSearchParams({ return: window.location.pathname + window.location.search });
  if (action) {
    params.set("action", action.kind);
    params.set("type", action.listingType);
    params.set("id", action.listingId);
  }
  return `/auth/continue?${params}`;
}

const HEADLINES = {
  signup: "Create your free account",
  save: "Create a free account to save this vendor",
  connect: "Create a free account to connect with this vendor",
};

export function GateModal({ googleEnabled }: { googleEnabled: boolean }) {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (current && !dialog.open) dialog.showModal();
    if (!current && dialog.open) dialog.close();
  }, [current]);

  return (
    <dialog
      ref={dialogRef}
      onClose={() => setState(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setState(null);
      }}
      aria-labelledby="gate-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/40"
    >
      {current?.mode === "auth" ? (
        <AuthStep reason={current.reason} action={current.action} googleEnabled={googleEnabled} />
      ) : current?.mode === "upgrade" ? (
        <UpgradeStep action={current.action} />
      ) : null}
    </dialog>
  );
}

function CloseButton() {
  return (
    <button
      type="button"
      onClick={() => setState(null)}
      aria-label="Close"
      className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-background hover:text-foreground"
    >
      ✕
    </button>
  );
}

function AuthStep({
  reason,
  action,
  googleEnabled,
}: {
  reason: "signup" | "save" | "connect";
  action?: PendingAction;
  googleEnabled: boolean;
}) {
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const callbackURL = () => {
    const url = new URL(continueUrl(action), window.location.origin);
    url.searchParams.set("terms", "1");
    if (marketing) url.searchParams.set("marketing", "1");
    return url.pathname + url.search;
  };

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) {
      setError("Please agree to the Terms and Privacy Policy.");
      return;
    }
    setStatus("sending");
    setError(null);
    const { error: err } = await signIn.magicLink({ email, callbackURL: callbackURL() });
    if (err) {
      setStatus("error");
      setError(err.message ?? "Could not send the link. Please try again.");
    } else setStatus("sent");
  }

  async function google() {
    if (!terms) {
      setError("Please agree to the Terms and Privacy Policy.");
      return;
    }
    await signIn.social({ provider: "google", callbackURL: callbackURL() });
  }

  return (
    <div className="relative p-6">
      <CloseButton />
      <h2 id="gate-title" className="pr-8 font-serif text-2xl font-semibold">
        {action ? HEADLINES[reason].replace("this vendor", action.name) : HEADLINES[reason]}
      </h2>
      {status === "sent" ? (
        <p className="mt-4 text-sm text-muted" role="status">
          Check <strong className="text-foreground">{email}</strong> for your sign-in link. It expires in 10 minutes.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">Takes 30 seconds. No password needed.</p>
          <div className="mt-5 space-y-3 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>
                I agree to the{" "}
                <a href="/terms" target="_blank" className="underline">Terms</a> and{" "}
                <a href="/privacy" target="_blank" className="underline">Privacy Policy</a>.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>Send me wedding planning tips and offers (optional).</span>
            </label>
          </div>
          {googleEnabled ? (
            <>
              <button
                type="button"
                onClick={google}
                className="mt-5 w-full rounded-full border border-border bg-white px-4 py-3 text-sm font-medium hover:bg-background"
              >
                Continue with Google
              </button>
              <div className="my-4 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
            </>
          ) : (
            <div className="mt-5" />
          )}
          <form onSubmit={sendLink} className="space-y-3">
            <label htmlFor="gate-email" className="sr-only">Email</label>
            <input
              id="gate-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-full border border-border bg-white px-4 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-full bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        </>
      )}
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function UpgradeStep({ action }: { action?: PendingAction }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function checkout() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ continueUrl: continueUrl(action) }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (data.url) window.location.href = data.url;
    else {
      setLoading(false);
      setError(data.error ?? "Checkout is unavailable right now.");
    }
  }
  return <PlanCard onUpgrade={checkout} loading={loading} error={error} onLater={() => setState(null)} />;
}

export function PlanCard({
  onUpgrade,
  onLater,
  loading,
  error,
}: {
  onUpgrade: () => void;
  onLater?: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="relative p-6">
      {onLater ? <CloseButton /> : null}
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Wedding Seeker Plus</p>
      <h2 id="gate-title" className="mt-1 pr-8 font-serif text-2xl font-semibold">
        Unlock every vendor in your area
      </h2>
      <ul className="mt-4 space-y-2 text-sm">
        {[
          "Phone, website and full address for every listing",
          "Unlimited results and full photo galleries",
          "Save vendors and venues to your shortlist",
          "One-click Connect with your wedding details",
          "A dashboard to track every request",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-sage">✓</span>
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">{process.env.NEXT_PUBLIC_PLAN_PRICE_LABEL ?? "Promo codes accepted at checkout."}</p>
      <button
        type="button"
        onClick={onUpgrade}
        disabled={loading}
        className="mt-5 w-full rounded-full bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {loading ? "Opening checkout…" : "Continue to secure checkout"}
      </button>
      {onLater ? (
        <button type="button" onClick={onLater} className="mt-2 w-full rounded-full px-4 py-2 text-sm text-muted hover:text-foreground">
          Maybe later
        </button>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
