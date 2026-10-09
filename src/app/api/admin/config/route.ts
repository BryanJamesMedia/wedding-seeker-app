import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin";
import { setConfig } from "@/lib/config";
import { CONFIG_KEYS } from "@/lib/config-defaults";

const Body = z.object({
  key: z.enum(Object.values(CONFIG_KEYS) as [string, ...string[]]),
  value: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]),
});

export async function PUT(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Value must be a JSON object or array." }, { status: 400 });
  await setConfig(parsed.data.key, parsed.data.value);
  return NextResponse.json({ ok: true });
}
