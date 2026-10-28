"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Props = {
  listingType: string;
  listingId: string;
  name: string;
  place: string;
  impact: { photos: number; claims: number; saves: number; connections: number; purchased: number; owner: string | null };
  after?: string;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function DeleteListingButton({ listingType, listingId, name, place, impact, after }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setTyped("");
    setError(null);
    dialogRef.current?.showModal();
  }

  async function confirmDelete(e: React.FormEvent) {
    e.preventDefault();
    if (typed !== "DELETE") return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/listings", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingType, listingId, confirm: typed }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Could not delete. Please try again.");
    dialogRef.current?.close();
    if (after) router.push(after);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={open} className="rounded-full border border-red-300 px-4 py-1.5 font-medium text-red-700 hover:bg-red-50">
        Delete
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-${listingId}`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-left text-foreground shadow-2xl backdrop:bg-black/40"
      >
        <form onSubmit={confirmDelete} className="space-y-4 p-6">
          <h2 id={`delete-${listingId}`} className="font-serif text-2xl font-semibold">Delete this listing?</h2>
          <p className="text-sm">
            <span className="font-semibold">{name}</span>
            {place ? <span className="text-muted"> · {place}</span> : null}
          </p>
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">This permanently removes:</p>
            <ul className="mt-1 list-disc pl-5">
              <li>the listing and its public page</li>
              <li>{plural(impact.photos, "photo")}</li>
              <li>{plural(impact.claims, "claim")}{impact.owner ? ` (owner ${impact.owner} loses access)` : ""}</li>
              <li>{plural(impact.saves, "couple save")}</li>
            </ul>
            {impact.connections ? (
              <p className="mt-2">
                {plural(impact.connections, "connection request")} ({impact.purchased} purchased) stay in Connection Requests as &quot;Deleted listing&quot;.
                {impact.purchased ? " The owner will no longer see those leads; their wallet charges stay." : ""}
              </p>
            ) : null}
          </div>
          <label className="block text-sm font-medium">
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={error ? `delete-error-${listingId}` : undefined}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-mono font-normal"
            />
          </label>
          {error ? <p id={`delete-error-${listingId}`} role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full border border-border px-5 py-2 hover:bg-accent-soft">
              Cancel
            </button>
            <button
              type="submit"
              disabled={typed !== "DELETE" || busy}
              className="rounded-full bg-red-700 px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
