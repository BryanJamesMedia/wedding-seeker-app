/**
 * Venue type groups. The database stores each venue's `venue_type` as a ", "
 * list of these names (a trigger converts raw types via `venue_type_map`), so
 * keep the names in sync with db/migrations/0015_venue_types.sql.
 */
export const VENUE_TYPE_GROUPS = [
  { value: "hotel-resort", label: "Hotel & Resort" },
  { value: "banquet-event-hall", label: "Banquet & Event Hall" },
  { value: "ballroom", label: "Ballroom" },
  { value: "barn-farm-ranch", label: "Barn, Farm & Ranch" },
  { value: "garden-park", label: "Garden & Park" },
  { value: "beach-waterfront", label: "Beach & Waterfront" },
  { value: "yacht-boat", label: "Yacht & Boat" },
  { value: "country-golf-club", label: "Country & Golf Club" },
  { value: "restaurant-bar", label: "Restaurant & Bar" },
  { value: "winery-vineyard", label: "Winery & Vineyard" },
  { value: "estate-historic", label: "Estate & Historic" },
  { value: "chapel-church", label: "Chapel & Church" },
  { value: "museum-gallery-studio", label: "Museum, Gallery & Studio" },
  { value: "conference-center", label: "Conference Center" },
  { value: "unique", label: "Unique Venues" },
] as const;

const LABELS = new Map<string, string>(VENUE_TYPE_GROUPS.map((g) => [g.value, g.label]));

export const isVenueTypeGroup = (value: string) => LABELS.has(value);
export const venueTypeLabel = (value: string) => LABELS.get(value) ?? value;
