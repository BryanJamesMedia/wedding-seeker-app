export type ListingType = "venue" | "vendor";

export const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: "venue", label: "Venues" },
  { value: "vendor", label: "Vendors" },
];

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
