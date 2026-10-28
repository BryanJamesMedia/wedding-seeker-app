"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function DeleteVendorButton({ userId, email, owned, balanceCents, leads }: { userId: string; email: string; owned: number; balanceCents: number; leads: number }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete(e: React.FormEvent) {
    e.preventDefault();
    if (typed !== "DELETE") return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/vendors", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, confirm: typed }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Could not delete. Please try again.");
    dialogRef.current?.close();
    router.push("/admin/vendors");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTyped("");
          setError(null);
          dialogRef.current?.showModal();
        }}
        className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Delete account
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="delete-vendor-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-left text-foreground shadow-2xl backdrop:bg-black/40"
      >
        <form onSubmit={confirmDelete} className="space-y-4 p-6">
          <h2 id="delete-vendor-title" className="font-serif text-2xl font-semibold">Delete this vendor account?</h2>
          <p className="text-sm font-semibold">{email}</p>
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">This permanently removes the account and signs it out everywhere, including:</p>
            <ul className="mt-1 list-disc pl-5">
              <li>its claims ({owned} owned {owned === 1 ? "listing" : "listings"} become unclaimed; the listings stay)</li>
              <li>its wallet history (balance ${(balanceCents / 100).toFixed(2)})</li>
              <li>{leads} purchased {leads === 1 ? "lead" : "leads"}</li>
            </ul>
            <p className="mt-2">The email address can sign up again later.</p>
          </div>
          <label className="block text-sm font-medium">
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-mono font-normal"
            />
          </label>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full border border-border px-5 py-2 hover:bg-accent-soft">
              Cancel
            </button>
            <button type="submit" disabled={typed !== "DELETE" || busy} className="rounded-full bg-red-700 px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
