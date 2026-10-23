"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/utils";

type Cell = string | number | boolean | null;
export type AdminRow = Record<string, Cell>;
export type AdminColumn = {
  key: string;
  label: string;
  kind?: "text" | "number" | "date" | "money";
  /** Row key holding a link for this cell. */
  href?: string;
  /** Row key to sort by instead of the displayed value. */
  sortKey?: string;
  wide?: boolean;
};

const fmtDate = (v: string) =>
  new Date(v).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function display(col: AdminColumn, v: Cell): string {
  if (v === null || v === "") return "";
  if (col.kind === "money") return formatMoney(Number(v));
  if (col.kind === "date") return fmtDate(String(v));
  return String(v);
}

function csvValue(col: AdminColumn, v: Cell): string {
  const s = col.kind === "money" && v !== null ? (Number(v) / 100).toFixed(2) : display(col, v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function AdminTable({
  columns,
  rows,
  filename,
  review,
  defaultSort,
}: {
  columns: AdminColumn[];
  rows: AdminRow[];
  filename: string;
  /** Adds Approve / Reject buttons to pending rows; POSTs { id, decision } to this endpoint. */
  review?: string;
  defaultSort?: { key: string; desc: boolean };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(defaultSort ?? { key: columns[0].key, desc: false });
  const [busy, setBusy] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((r) => columns.some((c) => display(c, r[c.key]).toLowerCase().includes(needle)))
      : rows;
    const col = columns.find((c) => c.key === sort.key);
    const key = col?.sortKey ?? sort.key;
    const numeric = col?.kind === "number" || col?.kind === "money";
    return [...filtered].sort((a, b) => {
      const x = a[key], y = b[key];
      if (x === null || x === "") return 1;
      if (y === null || y === "") return -1;
      const d = numeric ? Number(x) - Number(y) : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
      return sort.desc ? -d : d;
    });
  }, [rows, columns, q, sort]);

  function download() {
    const lines = [columns.map((c) => csvValue({ key: "", label: "" }, c.label)).join(",")];
    for (const r of shown) lines.push(columns.map((c) => csvValue(c, r[c.key])).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    if (decision === "rejected" && !confirm("Reject this request? The vendor gets a \"denied, contact support\" email.")) return;
    setBusy(id);
    const res = await fetch(review!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, decision }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      alert(body?.error ?? "Something went wrong. Please try again.");
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search this table"
          aria-label="Search this table"
          className="w-64 rounded-full border border-border px-4 py-2 text-sm"
        />
        <span className="text-sm text-muted">
          {shown.length === rows.length ? `${rows.length} rows` : `${shown.length} of ${rows.length} rows`}
        </span>
        <button type="button" onClick={download} className="ml-auto rounded-full border border-border px-4 py-2 text-sm hover:border-accent">
          Download CSV
        </button>
      </div>
      <div className="mt-3 max-h-[70vh] overflow-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-accent-soft text-xs uppercase tracking-wide">
            <tr>
              {review ? <th className="px-3 py-2">Action</th> : null}
              {columns.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} className="whitespace-nowrap px-3 py-2" aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}>
                    <button
                      type="button"
                      onClick={() => setSort({ key: c.key, desc: active ? !sort.desc : c.kind === "date" })}
                      className="inline-flex items-center gap-1 uppercase hover:text-accent"
                    >
                      {c.label}
                      <span aria-hidden>{active ? (sort.desc ? "▼" : "▲") : "↕"}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={String(r.id ?? i)} className="border-t border-border align-top hover:bg-accent-soft/40">
                {review ? (
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.status === "pending" ? (
                      <span className="flex gap-1">
                        <button type="button" disabled={busy === r.id} onClick={() => decide(String(r.id), "approved")} className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
                          Approve
                        </button>
                        <button type="button" disabled={busy === r.id} onClick={() => decide(String(r.id), "rejected")} className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-50">
                          Reject
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                ) : null}
                {columns.map((c) => {
                  const text = display(c, r[c.key]);
                  const href = c.href ? r[c.href] : null;
                  return (
                    <td key={c.key} className={`px-3 py-2 ${c.wide ? "min-w-64 max-w-md" : "whitespace-nowrap"} ${c.key === "status" ? "capitalize" : ""}`}>
                      {href && text ? (
                        String(href).startsWith("/admin") ? (
                          <Link href={String(href)} className="font-medium text-accent hover:underline">{text}</Link>
                        ) : (
                          <a href={String(href)} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">{text}</a>
                        )
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (review ? 1 : 0)} className="px-3 py-8 text-center text-muted">Nothing here yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
