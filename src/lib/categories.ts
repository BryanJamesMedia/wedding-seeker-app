export type ListingType = "venue" | "vendor";

export const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: "venue", label: "Venues" },
  { value: "vendor", label: "Vendors" },
];

/** Category spellings that mean the same thing, mapped to the one we keep (see db/migrations/0012). */
const CATEGORY_ALIASES: Record<string, string> = {
  catering_food_drink: "catering_food_drinks",
};

/** lower(btrim(category)) with known duplicate spellings folded into one. */
export function canonicalCategory(category: string): string {
  const key = category.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? key;
}

/** SQL version of `canonicalCategory` for a column expression. */
export function canonicalCategorySql(column: string): string {
  const cases = Object.entries(CATEGORY_ALIASES).map(([from, to]) => `WHEN '${from}' THEN '${to}'`).join(" ");
  return `(CASE lower(btrim(${column})) ${cases} ELSE lower(btrim(${column})) END)`;
}

const UPPERCASE = new Set(["dj", "djs", "bbq", "av", "diy", "lgbtq", "vip", "us", "usa"]);
const LOWERCASE = new Set(["and", "or", "of", "the", "for", "a", "an", "in", "on", "to", "with"]);

/** "dj_entertainment" → "DJ Entertainment", "hair_and_makeup" → "Hair and Makeup". Already-readable values are kept. */
export function categoryLabel(category: string): string {
  const words = category.trim().split(/[_\s-]+/).filter(Boolean);
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (UPPERCASE.has(lower)) return lower.toUpperCase();
      if (i > 0 && LOWERCASE.has(lower)) return lower;
      return word === word.toLowerCase() || word === word.toUpperCase() ? lower.charAt(0).toUpperCase() + lower.slice(1) : word;
    })
    .join(" ");
}
