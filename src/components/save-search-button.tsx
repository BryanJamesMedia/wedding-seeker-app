"use client";

import { useState } from "react";
import { BookmarkPlus, Check } from "lucide-react";
import { openAuthModal, openUpgradeModal } from "./gate-modal";

export function SaveSearchButton({ viewer, defaultName, query }: { viewer: "anonymous" | "unpaid" | "paid"; defaultName: string; query: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save() {
    if (viewer === "anonymous") return openAuthModal({ reason: "signup" });
    if (viewer === "unpaid") return openUpgradeModal();
    setState("saving");
    const res = await fetch("/api/saved-searches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: defaultName.slice(0, 80), query, weeklyAlert: true }) }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
  }
  return (
    <button type="button" onClick={save} disabled={state === "saving" || state === "saved"} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-sm disabled:opacity-70">
      {state === "saved" ? <Check className="size-4" aria-hidden /> : <BookmarkPlus className="size-4" aria-hidden />}
      {state === "saved" ? "Search saved" : state === "error" ? "Couldn't save" : "Save search"}
    </button>
  );
}
