"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Send } from "lucide-react";
import { openAuthModal, openUpgradeModal } from "./gate-modal";

export type ActionViewer = "anonymous" | "unpaid" | "paid";

export function ListingActions({
  viewer,
  listingType,
  listingId,
  name,
  saved: initialSaved,
  connectionStatus,
  size = "sm",
}: {
  viewer: ActionViewer;
  listingType: "venue" | "vendor";
  listingId: string;
  name: string;
  saved: boolean;
  connectionStatus: string | null;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const action = { listingType, listingId, name };

  function gate(kind: "save" | "connect") {
    if (viewer === "anonymous") return openAuthModal({ reason: kind, action: { kind, ...action } }), true;
    if (viewer === "unpaid") return openUpgradeModal({ kind, ...action }), true;
    return false;
  }

  async function toggleSave() {
    if (gate("save")) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    const res = await fetch("/api/saves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingType, listingId, saved: next }),
    }).catch(() => null);
    if (!res?.ok) setSaved(!next);
    setBusy(false);
  }

  function connect() {
    if (gate("connect")) return;
    const url = new URL(window.location.href);
    url.searchParams.set("connect", `${listingType}:${listingId}`);
    router.push(`${url.pathname}${url.search}`, { scroll: false });
  }

  const pad = size === "lg" ? "px-5 py-2.5 text-base" : "px-3 py-1.5 text-sm";
  const connected = connectionStatus != null;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={toggleSave}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
        className={`inline-flex items-center gap-1.5 rounded-full border ${pad} ${saved ? "border-accent bg-accent-soft text-accent" : "border-border bg-white hover:border-accent"}`}
      >
        <Heart className="size-4" fill={saved ? "currentColor" : "none"} aria-hidden />
        {saved ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={connect}
        disabled={connected}
        className={`inline-flex items-center gap-1.5 rounded-full ${pad} ${connected ? "border border-sage/40 bg-[#e7f3ee] text-sage" : "btn-coral"}`}
      >
        <Send className="size-4" aria-hidden />
        {connected ? "Connect sent" : "Connect"}
      </button>
    </div>
  );
}
