import { z } from "zod";

export const WeddingProfileSchema = z.object({
  partner1_name: z.string().max(100).nullish(),
  partner2_name: z.string().max(100).nullish(),
  contact_email: z.string().email().max(200).nullish(),
  contact_phone: z.string().max(40).nullish(),
  wedding_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal("")),
  target_month: z.number().int().min(1).max(12).nullish(),
  target_year: z.number().int().min(2024).max(2100).nullish(),
  location_text: z.string().max(200).nullish(),
  guest_count: z.number().int().min(1).max(5000).nullish(),
  budget_range: z.string().max(60).nullish(),
  vendors_needed: z.array(z.string().max(40)).max(20).optional(),
  settings: z.array(z.string().max(40)).max(10).optional(),
  vibe: z.string().max(500).nullish(),
});
