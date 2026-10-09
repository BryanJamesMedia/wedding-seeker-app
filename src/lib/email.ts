import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
export const FROM = process.env.EMAIL_FROM ?? "Wedding Seeker <onboarding@resend.dev>";
export const CONNECT_FROM = process.env.CONNECT_EMAIL_FROM ?? FROM;
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "b@lekmedia.com";
import { APP_URL } from "./urls";
export { APP_URL };

/** Only production may email real vendors; everything else goes to the test inbox. */
export function isProductionEmail(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.EMAIL_MODE === "production";
}

export function vendorRecipient(email: string): string {
  if (isProductionEmail()) return email;
  return process.env.VENDOR_TEST_INBOX ?? ADMIN_EMAIL;
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

/**
 * Best-effort delivery: a failure never breaks the calling flow. Returns the
 * Resend message id when sent.
 */
export async function sendEmail(args: SendArgs): Promise<string | null> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY unset, skipping "${args.subject}" to ${args.to}`);
    return null;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: args.from ?? FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo,
      headers: args.headers,
    });
    if (error) {
      console.error(`[email] Resend rejected "${args.subject}" to ${args.to}`, error);
      return null;
    }
    return data?.id ?? null;
  } catch (error) {
    console.error(`[email] failed to send "${args.subject}" to ${args.to}`, error);
    return null;
  }
}

export function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function layout(body: string, footer = ""): string {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;padding:24px;color:#2b2622;background:#fffdf9">
  <p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#9c6b5a;margin:0 0 16px">Wedding Seeker</p>
  ${body}
  <div style="margin-top:32px;font-family:system-ui,sans-serif;font-size:12px;color:#7a716b">${footer}</div>
</div>`;
}

export function button(href: string, label: string, color = "#9c4f3c"): string {
  return `<a href="${href}" style="background:${color};color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block;font-family:system-ui,sans-serif;font-size:14px;margin:4px 8px 4px 0">${escapeHtml(label)}</a>`;
}

export function sendMagicLinkEmail(to: string, url: string) {
  return sendEmail({
    to,
    subject: "Your Wedding Seeker sign-in link",
    html: layout(
      `<h1 style="font-size:22px;font-weight:normal">Sign in to Wedding Seeker</h1>
       <p>Click below to sign in. This link expires in 10 minutes.</p>
       <p>${button(url, "Sign in")}</p>
       <p style="font-size:13px;color:#7a716b">If you didn't request this, you can ignore this email.</p>`,
    ),
  });
}

export function sendWelcomeEmail(to: string) {
  return sendEmail({
    to,
    subject: "You're in — welcome to Wedding Seeker Plus",
    html: layout(
      `<h1 style="font-size:22px;font-weight:normal">Welcome to Wedding Seeker Plus</h1>
       <p>Contact details, unlimited results, saving and one-click Connect are now unlocked.</p>
       <p>Add your wedding details so vendors get everything they need when you Connect.</p>
       <p>${button(`${APP_URL}/dashboard`, "Open your dashboard")}</p>`,
    ),
  });
}

export function sendAdminNotice(subject: string, rows: Record<string, string | null | undefined>) {
  const body = Object.entries(rows)
    .filter(([, v]) => v)
    .map(([k, v]) => `<p style="margin:4px 0"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`)
    .join("");
  return sendEmail({ to: ADMIN_EMAIL, subject, html: layout(`<h1 style="font-size:20px;font-weight:normal">${escapeHtml(subject)}</h1>${body}`) });
}
