"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfigEditor({ label, configKey, initial }: { label: string; configKey: string; initial: unknown }) {
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));
  const [status, setStatus] = useState<string | null>(null);
  async function save() {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return setStatus("Not valid JSON");
    }
    const res = await fetch("/api/admin/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: configKey, value }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setStatus(res?.ok ? "Saved" : (body?.error ?? "Couldn't save"));
  }
  return (
    <details className="rounded-2xl border border-border bg-card p-4">
      <summary className="cursor-pointer font-medium">{label}</summary>
      <textarea aria-label={label} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(24, text.split("\n").length + 1)} className="mt-3 w-full rounded-xl border border-border bg-white p-3 font-mono text-xs" />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={save} className="rounded-full bg-accent px-4 py-2 text-sm text-white">Save</button>
        <p role="status" className="text-sm text-muted">{status}</p>
      </div>
    </details>
  );
}

export function ResolveButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/inbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
        router.refresh();
      }}
      className="rounded-full border border-border px-4 py-1.5 text-sm disabled:opacity-50"
    >
      Resolve
    </button>
  );
}
