/** Small 30-day bar chart; one bar per day. */
export function BarChart({ title, data }: { title: string; data: { day: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((n, d) => n + d.value, 0);
  const label = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <figure className="rounded-2xl border border-border bg-card p-4">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{title}</span>
        <span className="text-muted">{total} in 30 days</span>
      </figcaption>
      <div className="mt-3 flex h-28 items-end gap-0.5" role="img" aria-label={`${title}: ${total} in the last 30 days`}>
        {data.map((d) => (
          <div
            key={d.day}
            title={`${label(d.day)}: ${d.value}`}
            className="flex-1 rounded-t bg-accent/80 hover:bg-accent"
            style={{ height: `${Math.max(d.value ? 6 : 1, (d.value / max) * 100)}%`, opacity: d.value ? 1 : 0.25 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{data[0] ? label(data[0].day) : ""}</span>
        <span>{data.at(-1) ? label(data.at(-1)!.day) : ""}</span>
      </div>
    </figure>
  );
}

export function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const inner = (
    <>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </>
  );
  return href ? (
    <a href={href} className="rounded-2xl border border-border bg-card p-4 hover:border-accent">{inner}</a>
  ) : (
    <div className="rounded-2xl border border-border bg-card p-4">{inner}</div>
  );
}

/** Pending / Approved / Rejected / All filter links. */
export function StatusTabs({ base, current }: { base: string; current: string }) {
  return (
    <div className="mt-4 flex gap-2 text-sm">
      {(["pending", "approved", "rejected", "all"] as const).map((s) => (
        <a
          key={s}
          href={s === "pending" ? base : `${base}?status=${s}`}
          aria-current={current === s ? "page" : undefined}
          className={`rounded-full border px-3 py-1 capitalize ${current === s ? "border-foreground bg-foreground text-white" : "border-border hover:border-accent"}`}
        >
          {s}
        </a>
      ))}
    </div>
  );
}
