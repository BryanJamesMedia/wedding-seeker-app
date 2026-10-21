import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { purchaseLead } from "@/lib/leads";
import { notifyCoupleOfResponse } from "@/lib/connections";
import { formatMoney } from "@/lib/utils";

const Body = z.object({ requestId: z.string().uuid() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.account_type !== "vendor") return NextResponse.json({ error: "Only vendor accounts can purchase leads." }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const result = await purchaseLead(user.id, parsed.data.requestId);
  if (!result.ok && result.code === "not_found") {
    return NextResponse.json({ error: "This lead isn't available." }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `This lead costs ${formatMoney(result.priceCents)} and your wallet balance is ${formatMoney(result.balanceCents)}. Add funds to your wallet to purchase it.`,
        code: "insufficient_funds",
        priceCents: result.priceCents,
        balanceCents: result.balanceCents,
      },
      { status: 402 },
    );
  }
  if (!result.alreadyOwned) await notifyCoupleOfResponse(parsed.data.requestId);
  return NextResponse.json({ ok: true });
}
