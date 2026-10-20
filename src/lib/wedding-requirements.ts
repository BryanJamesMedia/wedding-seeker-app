/** Wedding details a couple must fill out in My Wedding before they can connect with vendors. */
export type WeddingFields = Partial<Record<
  "partner1_name" | "partner2_name" | "contact_email" | "contact_phone" | "wedding_date" | "target_month" | "target_year" | "location_text" | "guest_count" | "budget_range",
  unknown
>>;

const filled = (v: unknown) => v != null && String(v).trim() !== "";

const RULES: { label: string; ok: (p: WeddingFields) => boolean }[] = [
  { label: "Your name", ok: (p) => filled(p.partner1_name) },
  { label: "Partner's name", ok: (p) => filled(p.partner2_name) },
  { label: "Contact email", ok: (p) => filled(p.contact_email) },
  { label: "Contact phone", ok: (p) => filled(p.contact_phone) },
  { label: "Wedding date (or month and year)", ok: (p) => filled(p.wedding_date) || (filled(p.target_month) && filled(p.target_year)) },
  { label: "Location", ok: (p) => filled(p.location_text) },
  { label: "Guest count", ok: (p) => Number(p.guest_count) > 0 },
  { label: "Budget", ok: (p) => filled(p.budget_range) },
];

/** Labels of the required fields that are still empty; [] means the couple can connect. */
export function missingWeddingFields(profile: object | null | undefined): string[] {
  const p = (profile ?? {}) as WeddingFields;
  return RULES.filter((r) => !r.ok(p)).map((r) => r.label);
}
