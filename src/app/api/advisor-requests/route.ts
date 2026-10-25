import { NextResponse, after } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdvisorRequest, notifyAdvisorRequest } from "@/lib/advisor-requests";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const limited = await rateLimit(request, "advisor-requests", 5);
  if (limited) return limited;
  const body = await request.json().catch(() => null);
  const input = {
    name: text(body?.name, 200),
    email: text(body?.email, 200).toLowerCase(),
    phone: text(body?.phone, 40),
    message: (typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "") || null,
  };
  if (!input.name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!EMAIL.test(input.email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  if (input.phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  const row = await createAdvisorRequest(input);
  after(() => notifyAdvisorRequest(input, row.created_at));
  return NextResponse.json({ ok: true });
}
