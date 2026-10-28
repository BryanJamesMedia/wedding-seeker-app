import { queryOne } from "@/db";
import { APP_URL, SIGNUP_NOTIFY_EMAIL, escapeHtml, layout, sendEmail } from "./email";

type NewSignup = {
  email: string;
  name: string;
  account_type: "couple" | "vendor";
  created_at: Date;
  marketing_opt_in: boolean;
  terms_accepted_at: Date | null;
  google: boolean;
};

/** Emails the team about a new account, once per account (claimed atomically via signup_notified_at). */
export async function notifyNewSignup(userId: string): Promise<void> {
  const user = await queryOne<NewSignup>(
    `UPDATE users u SET signup_notified_at = now()
     WHERE u.id = $1 AND u.signup_notified_at IS NULL
     RETURNING u.email, u.name, u.account_type, u.created_at, u.marketing_opt_in, u.terms_accepted_at,
       EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.provider_id = 'google') AS google`,
    [userId],
  );
  if (!user) return;
  const kind = user.account_type === "vendor" ? "vendor" : "couple";
  const when = new Date(user.created_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
  const rows: [string, string][] = [
    ["Account type", kind === "vendor" ? "Vendor / venue" : "Couple"],
    ["Email", user.email],
    ["Name", user.name || "Not provided"],
    ["Signed up with", user.google ? "Google" : "Email code"],
    ["Signed up", `${when} ET`],
  ];
  if (kind === "couple") {
    rows.push(["Accepted terms", user.terms_accepted_at ? "Yes" : "No"], ["Marketing emails", user.marketing_opt_in ? "Opted in" : "Not opted in"]);
  }
  const subject = `New ${kind} sign-up: ${user.email}`;
  const body = rows.map(([k, v]) => `<p style="margin:4px 0"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join("");
  const note =
    kind === "vendor"
      ? `<p style="margin-top:16px;color:#555">Their name, role and phone come in when they claim a listing.</p>`
      : `<p style="margin-top:16px;color:#555">Wedding details appear in their dashboard once they fill out My Wedding.</p>`;
  await sendEmail({
    to: SIGNUP_NOTIFY_EMAIL,
    subject,
    html: layout(`<h1 style="font-size:20px;font-weight:normal">${escapeHtml(subject)}</h1>${body}${note}<p style="color:#555">${escapeHtml(APP_URL)}</p>`),
  });
}
