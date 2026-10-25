import "server-only";
import { queryOne } from "@/db";
import { APP_URL, SIGNUP_NOTIFY_EMAIL, escapeHtml, layout, sendEmail } from "./email";

export type AdvisorRequestInput = { name: string; email: string; phone: string; message: string | null };

export async function createAdvisorRequest(input: AdvisorRequestInput): Promise<{ id: string; created_at: Date }> {
  const row = await queryOne<{ id: string; created_at: Date }>(
    "INSERT INTO advisor_requests (name, email, phone, message) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
    [input.name, input.email, input.phone, input.message],
  );
  return row!;
}

export async function notifyAdvisorRequest(input: AdvisorRequestInput, createdAt: Date): Promise<void> {
  const when = createdAt.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
  const rows: [string, string][] = [
    ["Name", input.name],
    ["Email", input.email],
    ["Phone", input.phone],
    ["Looking for", input.message ?? "Not provided"],
    ["Submitted", `${when} ET`],
  ];
  const subject = `New wedding advisor request: ${input.name}`;
  const body = rows.map(([k, v]) => `<p style="margin:4px 0"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join("");
  await sendEmail({
    to: SIGNUP_NOTIFY_EMAIL,
    replyTo: input.email,
    subject,
    html: layout(
      `<h1 style="font-size:20px;font-weight:normal">${escapeHtml(subject)}</h1>${body}
       <p style="margin-top:16px;color:#555">They were told we'll reach out to schedule a meeting ($99 per category).</p>
       <p style="color:#555">${escapeHtml(APP_URL)}</p>`,
    ),
  });
}
