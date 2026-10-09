import type { Metadata } from "next";
import { queryOne } from "@/db";
import { verifyToken } from "@/lib/signing";
import { notifyCoupleOfResponse, setConnectionStatus } from "@/lib/connections";

export const metadata: Metadata = { title: "Thanks for responding", robots: { index: false } };

type Couple = { name: string; email: string; phone: string | null; partners: string | null };

/** Vendor one-click response from the Connect email. */
export default async function RespondPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const data = verifyToken<{ r: string; a: "interested" | "unavailable" }>(token);
  if (!data) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-semibold">This link has expired</h1>
        <p className="mt-2 text-muted">Reply to the original email and we&apos;ll pass your message along.</p>
      </div>
    );
  }
  const status = data.a === "interested" ? "responded_interested" : "responded_unavailable";
  const before = await queryOne<{ status: string }>("SELECT status FROM connection_requests WHERE id = $1", [data.r]);
  if (!before) return <p className="p-20 text-center">Request not found.</p>;
  if (!before.status.startsWith("responded")) {
    await setConnectionStatus(data.r, status, { via: "link" });
    await notifyCoupleOfResponse(data.r);
  }
  const couple =
    data.a === "interested"
      ? await queryOne<Couple>(
          `SELECT coalesce(c.wedding_snapshot->>'contact_email', u.email) AS email, c.wedding_snapshot->>'contact_phone' AS phone, u.name,
             nullif(concat_ws(' & ', c.wedding_snapshot->>'partner1_name', c.wedding_snapshot->>'partner2_name'), '') AS partners
           FROM connection_requests c JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
          [data.r],
        )
      : null;
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-serif text-3xl font-semibold">Thanks — we&apos;ve let them know</h1>
      {couple ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-left">
          <p className="text-sm text-muted">Reach out to</p>
          <p className="font-medium">{couple.partners ?? couple.name}</p>
          <p><a className="text-accent underline" href={`mailto:${couple.email}`}>{couple.email}</a></p>
          {couple.phone ? <p>{couple.phone}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-muted">We&apos;ve told the couple you&apos;re not available for their date.</p>
      )}
    </div>
  );
}
