import type { Metadata } from "next";
import Link from "next/link";
import { queryOne } from "@/db";
import { verifyToken } from "@/lib/signing";
import { notifyCoupleOfResponse, setConnectionStatus } from "@/lib/connections";

export const metadata: Metadata = { title: "Connection request", robots: { index: false } };

/**
 * One-click links from older Connect emails. "Interested" no longer reveals the couple's
 * contact details: it sends the vendor to their dashboard to purchase the lead.
 */
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
  const request = await queryOne<{ status: string; listing_type: string; listing_id: string; claimed: boolean }>(
    `SELECT c.status, c.listing_type, c.listing_id,
       EXISTS (SELECT 1 FROM listing_claims o WHERE o.listing_type = c.listing_type AND o.listing_id = c.listing_id AND o.status = 'approved') AS claimed
     FROM connection_requests c WHERE c.id = $1`,
    [data.r],
  );
  if (!request) return <p className="p-20 text-center">Request not found.</p>;

  if (data.a === "unavailable") {
    if (!request.status.startsWith("responded")) {
      await setConnectionStatus(data.r, "responded_unavailable", { via: "link" });
      await notifyCoupleOfResponse(data.r);
    }
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-semibold">Thanks — we&apos;ve let them know</h1>
        <p className="mt-2 text-muted">We&apos;ve told the couple you&apos;re not available for their date.</p>
      </div>
    );
  }
  const [href, label, text] = request.claimed
    ? [`/vendor/requests/${data.r}`, "View the request", "Sign in to your vendor dashboard to see this couple's wedding details and purchase the lead to get their email and phone number."]
    : [`/vendor/claim/${request.listing_type}/${request.listing_id}`, "Sign up and claim your listing", "Sign up for free and claim your listing to see this couple's request and connect with them."];
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-serif text-3xl font-semibold">Connect with this couple</h1>
      <p className="mt-2 text-muted">{text}</p>
      <Link href={href} className="mt-6 inline-block rounded-full bg-foreground px-6 py-2 text-white">{label}</Link>
    </div>
  );
}
