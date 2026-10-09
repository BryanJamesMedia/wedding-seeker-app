/**
 * Starting values for every runtime-editable config. The live values are read
 * from the `app_config` table (merged over these defaults), so tiers, filters,
 * thresholds and weights change without a deploy.
 */

export type FieldTier = "free" | "paid" | "hidden";

export const LISTING_FIELDS = [
  "id", "name", "category", "domain", "summary", "description", "vibe", "venue_type",
  "indoor_outdoor", "private_public", "address", "city", "state", "zip", "region",
  "latitude", "longitude", "location_link", "phone_1", "phone_2", "email_1", "email_2",
  "email_3", "instagram", "facebook", "review_score", "review_count", "capacity_min",
  "capacity_max", "capacity_notes", "price_min", "price_max", "price_notes", "services",
  "amenities", "parking", "alcohol_policy", "catering_policy", "accessibility", "hours",
  "year_established", "reservation_instructions", "photos", "status", "google_id",
  "account_ref", "pinecone_id", "embedding_updated_at", "created_at", "updated_at",
  "source_url", "event_url",
] as const;

export type ListingField = (typeof LISTING_FIELDS)[number];

export const DEFAULT_FIELD_VISIBILITY: Record<ListingField, FieldTier> = {
  id: "hidden",
  name: "free",
  category: "free",
  domain: "paid",
  summary: "free",
  description: "free",
  vibe: "free",
  venue_type: "free",
  indoor_outdoor: "free",
  private_public: "free",
  address: "paid",
  city: "free",
  state: "free",
  zip: "free",
  region: "free",
  latitude: "hidden",
  longitude: "hidden",
  location_link: "paid",
  phone_1: "paid",
  phone_2: "paid",
  email_1: "hidden",
  email_2: "hidden",
  email_3: "hidden",
  instagram: "paid",
  facebook: "paid",
  review_score: "free",
  review_count: "free",
  capacity_min: "free",
  capacity_max: "free",
  capacity_notes: "free",
  price_min: "free",
  price_max: "free",
  price_notes: "free",
  services: "free",
  amenities: "free",
  parking: "free",
  alcohol_policy: "free",
  catering_policy: "free",
  accessibility: "free",
  hours: "free",
  year_established: "free",
  reservation_instructions: "paid",
  // First `limits.freeImageCount` photos are free; the rest follow this tier.
  photos: "paid",
  status: "hidden",
  google_id: "hidden",
  account_ref: "hidden",
  pinecone_id: "hidden",
  embedding_updated_at: "hidden",
  created_at: "hidden",
  updated_at: "hidden",
  source_url: "hidden",
  event_url: "hidden",
};

/**
 * How a filter maps onto the `listings` view. Columns are whitelisted in
 * search.ts, so config edits can never inject SQL.
 */
export type FilterSource =
  | { kind: "range"; minColumn: string; maxColumn: string }
  | { kind: "capacity"; column: string }
  | { kind: "min"; column: string }
  | { kind: "any_of_text"; columns: string[] }
  | { kind: "equals_any"; column: string }
  | { kind: "array_overlaps"; column: string }
  | { kind: "not_empty"; column: string };

export type FilterInput = "range" | "number" | "select" | "multiselect" | "toggle";

export type FilterDef = {
  key: string;
  label: string;
  input: FilterInput;
  /** Lowercase category substrings this filter applies to; empty = all. */
  categories: string[];
  source: FilterSource;
  options?: { value: string; label: string }[];
  unit?: string;
  /** Per-category label override, e.g. per-guest pricing for caterers. */
  unitByCategory?: Record<string, string>;
};

export const DEFAULT_FILTERS: FilterDef[] = [
  {
    key: "price",
    label: "Price range",
    input: "range",
    categories: [],
    source: { kind: "range", minColumn: "price_min", maxColumn: "price_max" },
    unit: "$",
    unitByCategory: { cater: "$ per guest", photo: "$ flat" },
  },
  {
    key: "guests",
    label: "Guest capacity",
    input: "number",
    categories: ["venue", "cater"],
    source: { kind: "capacity", column: "capacity_max" },
    unit: "guests",
  },
  {
    key: "setting",
    label: "Setting",
    input: "multiselect",
    categories: ["venue"],
    source: { kind: "any_of_text", columns: ["venue_type"] },
    options: ["beach", "garden", "ballroom", "barn", "waterfront", "historic", "rooftop"].map((v) => ({
      value: v,
      label: v[0].toUpperCase() + v.slice(1),
    })),
  },
  {
    key: "indoor_outdoor",
    label: "Indoor / outdoor",
    input: "select",
    categories: ["venue"],
    source: { kind: "any_of_text", columns: ["indoor_outdoor"] },
    options: [
      { value: "indoor", label: "Indoor" },
      { value: "outdoor", label: "Outdoor" },
      { value: "both", label: "Both" },
    ],
  },
  {
    key: "rating",
    label: "Minimum rating",
    input: "select",
    categories: [],
    source: { kind: "min", column: "review_score" },
    options: [
      { value: "3", label: "3+ stars" },
      { value: "4", label: "4+ stars" },
      { value: "4.5", label: "4.5+ stars" },
    ],
  },
  {
    key: "style",
    label: "Style",
    input: "multiselect",
    categories: [],
    source: { kind: "any_of_text", columns: ["vibe", "description"] },
    options: ["boho", "classic", "modern", "rustic", "luxury", "budget-friendly"].map((v) => ({
      value: v,
      label: v[0].toUpperCase() + v.slice(1).replace("-", " "),
    })),
  },
  {
    key: "has_photos",
    label: "Has photos",
    input: "toggle",
    categories: [],
    source: { kind: "not_empty", column: "first_photo" },
  },
  {
    key: "has_website",
    label: "Has website",
    input: "toggle",
    categories: [],
    source: { kind: "not_empty", column: "domain" },
  },
];

export type RankingConfig = {
  descriptionWeight: number;
  vibeWeight: number;
  /** Max total quality boost; keep small so it only reorders near-ties. */
  boostCap: number;
  completenessWeight: number;
  photoWeight: number;
  ratingWeight: number;
};

export const DEFAULT_RANKING: RankingConfig = {
  descriptionWeight: 0.6,
  vibeWeight: 0.4,
  boostCap: 0.03,
  completenessWeight: 0.5,
  photoWeight: 0.2,
  ratingWeight: 0.3,
};

/** Score thresholds for match labels. Calibrate on 50+ real queries before launch. */
export type MatchLabelConfig = { top: number; great: number; good: number };

export const DEFAULT_MATCH_LABELS: MatchLabelConfig = { top: 0.55, great: 0.47, good: 0.4 };

export type LimitsConfig = {
  freeResultCap: number;
  freeImageCount: number;
  pageSize: number;
  connectsPerDay: number;
  showRatingToFree: boolean;
  /** Days before a couple may resend an unanswered Connect request. */
  resendAfterDays: number;
  /** Share the couple's email/phone in the first vendor email (open decision). */
  shareContactInFirstEmail: boolean;
};

export const DEFAULT_LIMITS: LimitsConfig = {
  freeResultCap: 20,
  freeImageCount: 3,
  pageSize: 20,
  connectsPerDay: 25,
  showRatingToFree: true,
  resendAfterDays: 7,
  shareContactInFirstEmail: false,
};

export type AppConfig = {
  fieldVisibility: Record<ListingField, FieldTier>;
  filters: FilterDef[];
  ranking: RankingConfig;
  matchLabels: MatchLabelConfig;
  limits: LimitsConfig;
};

export const CONFIG_KEYS = {
  fieldVisibility: "field_visibility",
  filters: "filters",
  ranking: "ranking",
  matchLabels: "match_labels",
  limits: "limits",
} as const;
