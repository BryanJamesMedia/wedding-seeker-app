"use client";

import { useRouter } from "next/navigation";

export function DeleteSearchButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/saved-searches", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
        router.refresh();
      }}
      className="rounded-full border border-border px-3 py-1.5 text-sm"
    >
      Remove
    </button>
  );
}
