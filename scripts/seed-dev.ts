/**
 * Local-development seed: realistic fake Florida venues and vendors so search,
 * gating and detail pages can be exercised without the production data copy.
 * Never run against production.
 */
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });

const CITIES: [string, string, number, number, string][] = [
  ["Miami", "33101", 25.7617, -80.1918, "South Florida"],
  ["Fort Lauderdale", "33301", 26.1224, -80.1373, "South Florida"],
  ["Naples", "34102", 26.142, -81.7948, "Southwest Florida"],
  ["Sarasota", "34236", 27.3364, -82.5307, "Gulf Coast"],
  ["St. Petersburg", "33701", 27.7676, -82.6403, "Tampa Bay"],
  ["Tampa", "33602", 27.9506, -82.4572, "Tampa Bay"],
  ["Orlando", "32801", 28.5383, -81.3792, "Central Florida"],
  ["St. Augustine", "32084", 29.9012, -81.3124, "Northeast Florida"],
  ["Jacksonville", "32202", 30.3322, -81.6557, "Northeast Florida"],
  ["Destin", "32541", 30.3935, -86.4958, "Panhandle"],
];

const VENUE_TYPES = ["beach", "garden", "ballroom", "barn", "waterfront", "historic", "rooftop"];
const VIBES = [
  "Relaxed boho beach ceremony at sunset, barefoot on the sand, laid-back and intimate",
  "Classic black-tie ballroom elegance with crystal chandeliers and a grand staircase",
  "Rustic barn with string lights, farm tables, wildflowers and a cozy country feel",
  "Modern minimalist rooftop with skyline views, clean lines and a cocktail-party vibe",
  "Lush tropical garden with palms, orchids and a romantic secret-garden atmosphere",
  "Historic Spanish-colonial courtyard with old-world charm and moss-draped oaks",
  "Luxury waterfront estate with yacht views, champagne toasts and white-glove service",
  "Budget-friendly, casual backyard style celebration that is fun and unfussy",
];
const VENDOR_CATEGORIES: [string, string[], [number, number]][] = [
  ["Photographer", ["Engagement shoots", "Second shooter", "Drone", "Same-day edits"], [1800, 6500]],
  ["Videographer", ["Highlight film", "Drone", "Livestream"], [2000, 7000]],
  ["Caterer", ["Plated dinner", "Buffet", "Food stations", "Bar service"], [45, 160]],
  ["Florist", ["Bridal bouquet", "Centerpieces", "Ceremony arch", "Boutonnieres"], [900, 8000]],
  ["DJ", ["MC services", "Uplighting", "Ceremony audio"], [900, 3000]],
  ["Wedding Planner", ["Full planning", "Day-of coordination", "Destination weddings"], [1500, 12000]],
  ["Hair & Makeup", ["Airbrush makeup", "Trials", "On-site styling"], [300, 2500]],
  ["Officiant", ["Bilingual ceremonies", "Custom vows", "Elopements"], [250, 900]],
  ["Cake & Desserts", ["Tiered cakes", "Dessert tables", "Gluten-free options"], [400, 2500]],
];
const NAME_A = ["Coastal", "Sunset", "Palm", "Magnolia", "Golden Hour", "Seaside", "Live Oak", "Coral", "Bayfront", "Citrus", "Saltwater", "Azure"];
const NAME_B_VENUE = ["Estate", "Gardens", "Pavilion", "Beach Club", "Manor", "Loft", "Inn", "Hall", "Ranch", "Terrace"];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const r = rand(42);
const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
const jitter = () => (r() - 0.5) * 0.25;
const photo = (i: number) => `https://picsum.photos/seed/ws${i}/1200/800`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("TRUNCATE venues RESTART IDENTITY CASCADE; TRUNCATE vendors CASCADE;");

  let photoSeed = 1;
  for (let i = 0; i < 140; i++) {
    const [city, zip, lat, lng, region] = CITIES[i % CITIES.length];
    const type = pick(VENUE_TYPES);
    const vibe = pick(VIBES);
    const name = `${pick(NAME_A)} ${pick(NAME_B_VENUE)}${i > 60 ? ` ${city}` : ""}`;
    const capMax = 50 + Math.floor(r() * 30) * 10;
    const photos = Array.from({ length: Math.floor(r() * 9) }, () => photo(photoSeed++));
    await client.query(
      `INSERT INTO venues (name, category, domain, summary, description, vibe, venue_type, indoor_outdoor, private_public,
        address, city, state, zip, region, latitude, longitude, location_link, phone_1, email_1, instagram, facebook,
        review_score, review_count, capacity_min, capacity_max, capacity_notes, price_min, price_max, price_notes,
        services, amenities, parking, alcohol_policy, catering_policy, accessibility, hours, year_established,
        reservation_instructions, photos, status, google_id)
       VALUES ($1,'Venue',$2,$3,$4,$5,$6,$7,$8,$9,$10,'FL',$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,
        $28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39)
       ON CONFLICT (google_id) WHERE google_id IS NOT NULL DO NOTHING`,
      [
        name,
        `${name.toLowerCase().replace(/[^a-z]+/g, "")}.example.com`,
        `${type[0].toUpperCase() + type.slice(1)} venue in ${city} for up to ${capMax} guests.`,
        `${name} is a ${type} wedding venue in ${city}, Florida. ${vibe}. Our team handles ceremonies and receptions, with on-site coordination and flexible packages.`,
        vibe,
        type,
        pick(["indoor", "outdoor", "both"]),
        pick(["private", "public"]),
        `${100 + i} ${pick(["Ocean", "Bay", "Palm", "Main", "Harbor"])} ${pick(["Dr", "Ave", "Blvd", "St"])}, ${city}, FL ${zip}`,
        city,
        zip,
        region,
        lat + jitter(),
        lng + jitter(),
        `https://maps.google.com/?q=${encodeURIComponent(name + " " + city)}`,
        `(305) 555-${String(1000 + i).slice(-4)}`,
        r() > 0.15 ? `events+venue${i}@example.com` : null,
        r() > 0.3 ? `https://instagram.com/venue${i}` : null,
        r() > 0.5 ? `https://facebook.com/venue${i}` : null,
        r() > 0.1 ? (3.5 + r() * 1.5).toFixed(1) : null,
        Math.floor(r() * 400),
        20,
        capMax,
        r() > 0.5 ? "Seated dinner capacity; standing receptions allow 20% more." : null,
        3000 + Math.floor(r() * 10) * 1000,
        15000 + Math.floor(r() * 30) * 1000,
        r() > 0.5 ? "Saturday pricing; Fridays and Sundays 20% less." : null,
        ["Ceremony", "Reception", "Rehearsal dinner"].slice(0, 1 + Math.floor(r() * 3)),
        ["Bridal suite", "Dance floor", "Tables & chairs", "Sound system", "Rain backup"].slice(0, 1 + Math.floor(r() * 5)),
        pick(["Free on-site lot", "Valet", "Street parking"]),
        pick(["Licensed bartenders required", "BYOB allowed", "In-house bar only"]),
        pick(["Preferred caterer list", "In-house catering", "Outside catering allowed"]),
        r() > 0.5 ? "ADA accessible ceremony and reception spaces" : null,
        "Tours Tue–Sat 10am–5pm",
        1950 + Math.floor(r() * 70),
        r() > 0.5 ? "Book a tour online; 30% deposit holds the date." : null,
        photos,
        r() > 0.05 ? "active" : "pending",
        `seed-venue-${i}`,
      ],
    );
  }

  for (let i = 0; i < 260; i++) {
    const [city, zip, lat, lng, region] = CITIES[i % CITIES.length];
    const [category, services, [pmin, pmax]] = VENDOR_CATEGORIES[i % VENDOR_CATEGORIES.length];
    const vibe = pick(VIBES).replace(/ceremony|venue|barn|ballroom|estate|garden|courtyard|rooftop/gi, "style");
    const name = `${pick(NAME_A)} ${category}${i > 90 ? ` Co. ${i}` : " Co."}`;
    const photos = Array.from({ length: Math.floor(r() * 8) }, () => photo(photoSeed++));
    await client.query(
      `INSERT INTO vendors (name, category, domain, summary, description, vibe, address, city, state, zip, region,
        latitude, longitude, phone_1, email_1, instagram, review_score, review_count, price_min, price_max, price_notes,
        services, hours, year_established, reservation_instructions, photos, status, google_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'FL',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,'active',$26)`,
      [
        name,
        category,
        r() > 0.2 ? `${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example.com` : null,
        `${category} serving ${city} and ${region}.`,
        `${name} is a ${category.toLowerCase()} based in ${city}. ${vibe}. We work weddings of every size across ${region}.`,
        vibe,
        `${200 + i} ${pick(["Commerce", "Central", "Lake", "Park"])} ${pick(["Ave", "St"])}, ${city}, FL ${zip}`,
        city,
        zip,
        region,
        lat + jitter(),
        lng + jitter(),
        `(813) 555-${String(2000 + i).slice(-4)}`,
        r() > 0.15 ? `hello+vendor${i}@example.com` : null,
        r() > 0.3 ? `https://instagram.com/vendor${i}` : null,
        r() > 0.1 ? (3.5 + r() * 1.5).toFixed(1) : null,
        Math.floor(r() * 250),
        pmin + Math.floor(r() * 5) * Math.round(pmin / 5),
        pmax,
        category === "Caterer" ? "Per guest, before service charge and tax." : null,
        services.slice(0, 1 + Math.floor(r() * services.length)),
        "Mon–Fri 9am–6pm",
        1990 + Math.floor(r() * 34),
        r() > 0.5 ? "Inquire with your date; 25% retainer books." : null,
        photos,
        `seed-vendor-${i}`,
      ],
    );
  }
  const { rows } = await client.query("SELECT count(*) FROM listings WHERE status = 'active'");
  console.log(`seeded; active listings: ${rows[0].count}`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
