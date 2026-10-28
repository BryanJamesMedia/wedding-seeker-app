-- Wedding Seeker: full schema. Paste into the Neon SQL Editor and click Run. Safe to re-run.

-- ===== 0001_listings.sql =====
-- Listing tables keep the 50 source columns so records copy straight over,
-- plus the app-owned columns (slug, geog, embeddings, connect settings).
-- Embedding dimension (1536) must match EMBEDDING_DIMENSIONS / EMBEDDING_MODEL.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS venues (
  id serial PRIMARY KEY,
  name text NOT NULL,
  category text,
  domain text,
  summary text,
  description text,
  vibe text,
  venue_type text,
  indoor_outdoor text,
  private_public text,
  address text,
  city text,
  state text,
  zip text,
  region text,
  latitude numeric,
  longitude numeric,
  location_link text,
  phone_1 text,
  phone_2 text,
  email_1 text,
  email_2 text,
  email_3 text,
  instagram text,
  facebook text,
  review_score numeric,
  review_count integer,
  capacity_min integer,
  capacity_max integer,
  capacity_notes text,
  price_min numeric,
  price_max numeric,
  price_notes text,
  services text[],
  amenities text[],
  parking text,
  alcohol_policy text,
  catering_policy text,
  accessibility text,
  hours text,
  year_established integer,
  reservation_instructions text,
  photos text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'hidden', 'closed')),
  google_id text,
  account_ref text,
  embedding_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_url text,
  -- app-owned
  slug text,
  geog geography(Point, 4326) GENERATED ALWAYS AS (
    CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography
    END
  ) STORED,
  description_embedding vector(1536),
  vibe_embedding vector(1536),
  embedding_model text,
  embedded_description_hash text,
  embedded_vibe_hash text,
  completeness_score numeric,
  connect_email text,
  unsubscribed_at timestamptz
);

CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  domain text,
  summary text,
  description text,
  vibe text,
  venue_type text,
  indoor_outdoor text,
  private_public text,
  address text,
  city text,
  state text,
  zip text,
  region text,
  latitude numeric,
  longitude numeric,
  location_link text,
  phone_1 text,
  phone_2 text,
  email_1 text,
  email_2 text,
  email_3 text,
  instagram text,
  facebook text,
  review_score numeric,
  review_count integer,
  capacity_min integer,
  capacity_max integer,
  capacity_notes text,
  price_min numeric,
  price_max numeric,
  price_notes text,
  services text[],
  amenities text[],
  parking text,
  alcohol_policy text,
  catering_policy text,
  accessibility text,
  hours text,
  year_established integer,
  reservation_instructions text,
  photos text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'hidden', 'closed')),
  google_id text,
  account_ref text,
  embedding_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_url text,
  -- app-owned
  slug text,
  geog geography(Point, 4326) GENERATED ALWAYS AS (
    CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography
    END
  ) STORED,
  description_embedding vector(1536),
  vibe_embedding vector(1536),
  embedding_model text,
  embedded_description_hash text,
  embedded_vibe_hash text,
  completeness_score numeric,
  connect_email text,
  unsubscribed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS venues_slug_key ON venues (slug);
CREATE UNIQUE INDEX IF NOT EXISTS vendors_slug_key ON vendors (slug);
CREATE UNIQUE INDEX IF NOT EXISTS venues_google_id_key ON venues (google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vendors_google_id_key ON vendors (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS venues_geog_idx ON venues USING gist (geog);
CREATE INDEX IF NOT EXISTS vendors_geog_idx ON vendors USING gist (geog);
CREATE INDEX IF NOT EXISTS venues_status_category_idx ON venues (status, category);
CREATE INDEX IF NOT EXISTS vendors_status_category_idx ON vendors (status, category);
CREATE INDEX IF NOT EXISTS venues_state_city_idx ON venues (state, city);
CREATE INDEX IF NOT EXISTS vendors_state_city_idx ON vendors (state, city);

-- Slugs, completeness and updated_at are maintained in the database so that
-- records copied in by external jobs (scraping, Yelp, enrichment) need no app code.
CREATE OR REPLACE FUNCTION ws_slugify(input text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'))
$$;

CREATE OR REPLACE FUNCTION ws_listing_before_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  base text;
  candidate text;
  n integer := 1;
  taken boolean;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := nullif(ws_slugify(NEW.name || CASE WHEN NEW.city IS NOT NULL THEN ' ' || NEW.city ELSE '' END), '');
    base := coalesce(base, 'listing');
    candidate := base;
    LOOP
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE slug = $1)', TG_TABLE_NAME) INTO taken USING candidate;
      EXIT WHEN NOT taken;
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  END IF;

  NEW.completeness_score :=
    (CASE WHEN coalesce(NEW.description, '') <> '' THEN 0.2 ELSE 0 END) +
    (CASE WHEN coalesce(NEW.vibe, '') <> '' THEN 0.1 ELSE 0 END) +
    (CASE WHEN coalesce(array_length(NEW.photos, 1), 0) >= 3 THEN 0.2
          WHEN coalesce(array_length(NEW.photos, 1), 0) >= 1 THEN 0.1 ELSE 0 END) +
    (CASE WHEN coalesce(NEW.domain, '') <> '' THEN 0.1 ELSE 0 END) +
    (CASE WHEN coalesce(NEW.phone_1, '') <> '' THEN 0.1 ELSE 0 END) +
    (CASE WHEN NEW.price_min IS NOT NULL OR NEW.price_max IS NOT NULL THEN 0.1 ELSE 0 END) +
    (CASE WHEN NEW.capacity_max IS NOT NULL THEN 0.1 ELSE 0 END) +
    (CASE WHEN coalesce(array_length(NEW.services, 1), 0) > 0 THEN 0.1 ELSE 0 END);

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venues_before_write ON venues;
CREATE TRIGGER venues_before_write BEFORE INSERT OR UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION ws_listing_before_write();
DROP TRIGGER IF EXISTS vendors_before_write ON vendors;
CREATE TRIGGER vendors_before_write BEFORE INSERT OR UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION ws_listing_before_write();

-- Old slugs keep redirecting after a rename.
CREATE TABLE IF NOT EXISTS listing_slug_history (
  listing_type text NOT NULL CHECK (listing_type IN ('venue', 'vendor')),
  old_slug text NOT NULL,
  listing_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_type, old_slug)
);

CREATE OR REPLACE VIEW listings AS
SELECT
  'venue'::text AS listing_type, id::text AS listing_id, slug, name, category, summary,
  description, vibe, venue_type, indoor_outdoor, private_public, address, city, state, zip, region,
  geog, location_link, domain, phone_1, phone_2, instagram, facebook, review_score, review_count,
  capacity_min, capacity_max, capacity_notes, price_min, price_max, price_notes, services, amenities,
  parking, alcohol_policy, catering_policy, accessibility, hours, year_established,
  reservation_instructions, photos, photos[1] AS first_photo, description_embedding, vibe_embedding,
  embedding_model, completeness_score, status, unsubscribed_at,
  coalesce(nullif(connect_email, ''), nullif(email_1, ''), nullif(email_2, ''), nullif(email_3, '')) AS connect_to,
  created_at, updated_at
FROM venues
UNION ALL
SELECT
  'vendor'::text, id::text, slug, name, category, summary,
  description, vibe, venue_type, indoor_outdoor, private_public, address, city, state, zip, region,
  geog, location_link, domain, phone_1, phone_2, instagram, facebook, review_score, review_count,
  capacity_min, capacity_max, capacity_notes, price_min, price_max, price_notes, services, amenities,
  parking, alcohol_policy, catering_policy, accessibility, hours, year_established,
  reservation_instructions, photos, photos[1], description_embedding, vibe_embedding,
  embedding_model, completeness_score, status, unsubscribed_at,
  coalesce(nullif(connect_email, ''), nullif(email_1, ''), nullif(email_2, ''), nullif(email_3, '')),
  created_at, updated_at
FROM vendors;


-- ===== 0002_app_tables.sql =====
-- App-owned tables. Listings are referenced by (listing_type, listing_id text)
-- because venues use integer ids and vendors use uuids.

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- billing
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  plan_status text NOT NULL DEFAULT 'unpaid' CHECK (plan_status IN ('unpaid', 'paid')),
  paid_until timestamptz,
  -- consent and preferences
  terms_accepted_at timestamptz,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  email_connect_confirmations boolean NOT NULL DEFAULT true,
  email_saved_search_alerts boolean NOT NULL DEFAULT true,
  is_admin boolean NOT NULL DEFAULT false,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wedding_profiles (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  partner1_name text,
  partner2_name text,
  contact_email text,
  contact_phone text,
  wedding_date date,
  target_month integer CHECK (target_month BETWEEN 1 AND 12),
  target_year integer,
  location_text text,
  location_lat numeric,
  location_lng numeric,
  guest_count integer,
  budget_range text,
  settings text[] NOT NULL DEFAULT '{}',
  vibe text CHECK (char_length(vibe) <= 500),
  vendors_needed text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_listings (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_type text NOT NULL CHECK (listing_type IN ('venue', 'vendor')),
  listing_id text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_type, listing_id)
);

CREATE TABLE IF NOT EXISTS connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable so history survives account deletion in anonymized form
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('venue', 'vendor')),
  listing_id text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN
    ('pending_outreach', 'sent', 'delivered', 'opened', 'responded_interested', 'responded_unavailable', 'bounced')),
  message text,
  wedding_snapshot jsonb NOT NULL DEFAULT '{}',
  vendor_email text,
  resend_email_id text,
  resent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS connection_requests_user_idx ON connection_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS connection_requests_listing_idx ON connection_requests (listing_type, listing_id);
CREATE INDEX IF NOT EXISTS connection_requests_resend_idx ON connection_requests (resend_email_id);
-- one open request per couple per listing
CREATE UNIQUE INDEX IF NOT EXISTS connection_requests_open_key ON connection_requests (user_id, listing_type, listing_id)
  WHERE user_id IS NOT NULL AND status NOT IN ('responded_interested', 'responded_unavailable', 'bounced');

CREATE TABLE IF NOT EXISTS connection_events (
  id bigserial PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES connection_requests(id) ON DELETE CASCADE,
  type text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  query jsonb NOT NULL,
  weekly_alert boolean NOT NULL DEFAULT false,
  last_alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  anon_id text,
  categories text[],
  location_text text,
  radius_miles integer,
  filters jsonb,
  has_description boolean NOT NULL DEFAULT false,
  result_count integer,
  duration_ms integer,
  clicked jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_logs_created_idx ON search_logs (created_at DESC);

-- Query embeddings cached by hash of the normalized text.
CREATE TABLE IF NOT EXISTS query_embeddings (
  text_hash text NOT NULL,
  model text NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (text_hash, model)
);

CREATE TABLE IF NOT EXISTS geocode_cache (
  query text PRIMARY KEY,
  label text NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Admin queue: pending outreach, claim requests, info reports.
CREATE TABLE IF NOT EXISTS admin_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('pending_outreach', 'claim', 'report')),
  listing_type text,
  listing_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_unsubscribes (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pending Save/Connect action stored before sign-up so it survives the
-- auth + checkout round trip.
CREATE TABLE IF NOT EXISTS pending_actions (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  action jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Config edited without a deploy (admin page or directly in Neon).
-- key: 'field_visibility' | 'filters' | 'ranking' | 'match_labels' | 'limits'
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ===== 0003_drop_pinecone.sql =====
-- Vectors live in Neon pgvector (description_embedding / vibe_embedding); Pinecone is not used.
ALTER TABLE venues DROP COLUMN IF EXISTS pinecone_id;
ALTER TABLE vendors DROP COLUMN IF EXISTS pinecone_id;


-- ===== 0004_listing_photos.sql =====
-- Baseline for listing_photos, which was created by hand in the live Neon database.
-- Every statement is IF NOT EXISTS, so on the live database this file changes nothing;
-- it only creates the same structure on a fresh database (local dev, new branches).
-- Do not add renames, drops or type changes here.

CREATE TABLE IF NOT EXISTS listing_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid REFERENCES vendors(id) ON DELETE CASCADE,
  venue_id      integer REFERENCES venues(id) ON DELETE CASCADE,
  blob_url      text NOT NULL,
  blob_path     text NOT NULL,
  origin        text NOT NULL DEFAULT 'scraped' CHECK (origin IN ('scraped', 'owner')),
  status        text NOT NULL DEFAULT 'active'  CHECK (status IN ('active', 'hidden', 'removed')),
  sort_order    int  NOT NULL DEFAULT 0,
  width         int,
  height        int,
  bytes         int,
  alt           text,
  source_url    text,
  found_on      text,
  content_hash  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_photos_vendor_id_content_hash_key UNIQUE (vendor_id, content_hash),
  CONSTRAINT listing_photos_venue_hash_unique UNIQUE (venue_id, content_hash),
  CONSTRAINT listing_photos_one_parent CHECK (num_nonnulls(vendor_id, venue_id) = 1)
);
CREATE INDEX IF NOT EXISTS listing_photos_vendor_idx ON listing_photos (vendor_id, status, sort_order);
CREATE INDEX IF NOT EXISTS listing_photos_venue_idx ON listing_photos (venue_id, status, sort_order);

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cover_photo_id uuid REFERENCES listing_photos(id) ON DELETE SET NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS cover_photo_id uuid REFERENCES listing_photos(id) ON DELETE SET NULL;


-- ===== 0005_geocoding.sql =====
-- Geocoding: fills latitude/longitude (and so geog) for listings that have an
-- address / ZIP / city but no coordinates. Run by /api/cron/geocode.
-- geocode_source NULL = coordinates came from the source data and are never overwritten.

CREATE TABLE IF NOT EXISTS zip_centroids (
  zip text PRIMARY KEY,
  lat numeric NOT NULL,
  lng numeric NOT NULL
);

ALTER TABLE venues ADD COLUMN IF NOT EXISTS geocode_source text CHECK (geocode_source IN ('census', 'zip', 'city', 'none'));
ALTER TABLE venues ADD COLUMN IF NOT EXISTS geocode_input text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS geocode_source text CHECK (geocode_source IN ('census', 'zip', 'city', 'none'));
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS geocode_input text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

-- The address text a listing was geocoded from; a change triggers a re-geocode.
CREATE OR REPLACE FUNCTION ws_geocode_input(address text, city text, state text, zip text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT concat_ws('|', nullif(btrim(address), ''), nullif(btrim(city), ''), nullif(btrim(state), ''), nullif(left(btrim(zip), 5), ''))
$$;

-- If coordinates are edited by anything other than the geocoder (which always
-- sets geocoded_at), treat them as real and stop managing them.
CREATE OR REPLACE FUNCTION ws_geocode_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.geocode_source IS NOT NULL
     AND (NEW.latitude, NEW.longitude) IS DISTINCT FROM (OLD.latitude, OLD.longitude)
     AND NEW.geocoded_at IS NOT DISTINCT FROM OLD.geocoded_at THEN
    NEW.geocode_source := NULL;
    NEW.geocode_input := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venues_geocode_guard ON venues;
CREATE TRIGGER venues_geocode_guard BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION ws_geocode_guard();
DROP TRIGGER IF EXISTS vendors_geocode_guard ON vendors;
CREATE TRIGGER vendors_geocode_guard BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION ws_geocode_guard();


-- ===== 0006_blog_posts.sql =====
-- Blog posts. Insert rows directly (Neon SQL Editor). One row = one post at /blog/<slug>.
-- Body is `blocks`: a JSON array of content blocks rendered in order. Block types:
--   {"type":"paragraph","text":"Supports **bold**, *italic* and [links](/search).","dropCap":false}
--   {"type":"heading","text":"Section title","level":2,"eyebrow":"Step 01"}
--   {"type":"image","src":"https://...jpg","alt":"Describe the photo","caption":"Optional","aspect":"wide|square|portrait"}
--   {"type":"imageText","layout":"imageLeft|imageRight","src":"...","alt":"...","heading":"Optional","text":"..."}
--   {"type":"steps","items":[{"title":"...","text":"..."}]}
--   {"type":"checklist","title":"Optional","items":["...","..."]}
--   {"type":"table","headers":["A","B"],"rows":[["1","2"]],"caption":"Optional"}
--   {"type":"callout","variant":"tip|info|warning","title":"Optional","text":"..."}
--   {"type":"quote","text":"...","cite":"Optional — who said it"}
--   {"type":"faq","items":[{"q":"Question?","a":"Answer."}]}
--   {"type":"cta","heading":"...","text":"Optional","buttonLabel":"Start Your Search","buttonHref":"/search"}
-- Unknown block types are skipped, so a typo never breaks the page.

CREATE TABLE IF NOT EXISTS blog_posts (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL,
  subtitle text,
  excerpt text,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  featured_image text,
  featured_image_alt text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
  author_name text,
  author_role text,
  author_image text,
  author_bio text,
  read_minutes integer CHECK (read_minutes > 0),
  seo_title text,
  seo_description text,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON blog_posts (published_at DESC) WHERE published;
CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON blog_posts (lower(category)) WHERE published;

CREATE OR REPLACE FUNCTION ws_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blog_posts_touch ON blog_posts;
CREATE TRIGGER blog_posts_touch BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION ws_touch_updated_at();


-- ===== 0007_blog_seed.sql =====
-- Starter posts copied from the marketing site's blog. Skipped if a post with the same slug exists.

INSERT INTO blog_posts (slug, title, subtitle, excerpt, category, tags, featured_image, featured_image_alt, blocks, author_name, author_role, author_image, author_bio, read_minutes, seo_title, seo_description, featured, published, published_at)
VALUES ('10-questions-to-ask-your-wedding-venue',
  '10 Essential Questions to Ask Your Wedding Venue Before Booking',
  'The venue contract you sign today shapes every decision that follows. Here''s the exact list to walk through before you put down a deposit.',
  'The questions every couple wishes they''d asked before signing the contract. Avoid surprise fees, scheduling conflicts, and the dreaded moment your photographer says ''wait, no flash?''.',
  'Venues',
  ARRAY['Venues', 'Contracts', 'Budget', 'Planning']::text[],
  '/blog/blog-venue-hero.jpg',
  'Elegant wedding venue with chandeliers and floral centerpieces',
  '[{"type":"paragraph","dropCap":true,"text":"Your venue isn''t just where you say \"I do.\" It anchors your guest count, your budget, your catering choices, and even what your photos will look like ten years from now. Yet most couples sign a contract after a single tour, swept up in the excitement of finally finding “the one.”"},{"type":"paragraph","text":"We''ve seen what happens when the right questions don''t get asked. Surprise service charges. Rules that quietly cancel your sparkler exit. End times that send your reception home an hour early. The good news? Every one of these is avoidable with the checklist below."},{"type":"paragraph","text":"Bring this list to every venue tour. The answers will tell you almost everything you need to know — both about the venue and how they''ll treat you on the day that matters most."},{"type":"callout","variant":"tip","title":"Advisor Tip","text":"Ask for everything in writing. A friendly verbal “sure, we can do that” on a tour is worth exactly nothing six months later when the coordinator who said it has moved on."},{"type":"heading","level":2,"text":"Before You Even Schedule a Tour"},{"type":"paragraph","text":"These three questions filter out venues that won''t work before you spend a Saturday driving across the county. Email or call ahead — any venue worth your money will answer them gladly."},{"type":"heading","level":3,"eyebrow":"01","text":"Is our date actually available?"},{"type":"paragraph","text":"Sounds obvious — but ask whether they hold tentative bookings, how long those holds last, and whether they''ll notify you if another couple is also considering your date. Saturdays in May, June, September, and October book out 12–18 months ahead in most markets."},{"type":"heading","level":3,"eyebrow":"02","text":"What''s the total all-in cost for our guest count?"},{"type":"paragraph","text":"Site fee, food, beverage, service, gratuity, taxes, and any required rentals — all of it. Many venues quote a starting site fee that doubles or triples once minimums and service charges are added. Get a sample estimate for *your* date and headcount in writing."},{"type":"heading","level":3,"eyebrow":"03","text":"What does the deposit and payment schedule look like?"},{"type":"paragraph","text":"Find out what''s due at signing, what''s due at intervals, and what''s refundable if you cancel or postpone. Look for clear language about force majeure — the pandemic taught the industry a lot, but not every contract has caught up."},{"type":"image","src":"/blog/blog-venue-outdoor.jpg","alt":"Outdoor wedding venue with string lights at golden hour","caption":"Outdoor venues add magic — and a long list of weather-related questions you can''t skip."},{"type":"heading","level":2,"text":"On the Tour: What to Look For"},{"type":"paragraph","text":"You''re not just touring a space — you''re interviewing a team. The way a venue answers these next four questions tells you exactly how they''ll handle your wedding day."},{"type":"heading","level":3,"eyebrow":"04","text":"What''s included — and what costs extra?"},{"type":"paragraph","text":"Tables, chairs, linens, dance floor, sound system, lighting, set-up, breakdown, valet, security, cleaning. Every item is either “included,” “available for a fee,” or “not offered.” Get the full list, with prices, before you fall in love with the chandeliers."},{"type":"heading","level":3,"eyebrow":"05","text":"Can we bring our own vendors, or do you have a preferred list?"},{"type":"paragraph","text":"Some venues mandate certain caterers or bartenders. Others charge an outside-vendor fee. A few welcome anyone insured. There''s no wrong policy — but you need to know before you book your photographer or florist."},{"type":"heading","level":3,"eyebrow":"06","text":"How many events happen here in a single day?"},{"type":"paragraph","text":"If another wedding ends at 4 p.m. and yours starts at 6 p.m., your team has two hours to flip the room. That''s tight. Ask about turnover time, whether you can access the space for an early walk-through, and what happens if the prior event runs long."},{"type":"heading","level":3,"eyebrow":"07","text":"What''s the rain plan?"},{"type":"paragraph","text":"Even “indoor” venues with outdoor cocktail patios need a clear rain plan. Ask: who decides, when do they decide, and does the alternate space comfortably hold your guest count? Then go look at it. Don''t book a venue whose Plan B you haven''t seen with your own eyes."},{"type":"image","src":"/blog/blog-venue-rustic.jpg","alt":"Rustic barn wedding venue with Edison bulb lights","caption":"Charming spaces often come with the strictest rules — ask early."},{"type":"heading","level":2,"text":"Before You Sign Anything"},{"type":"heading","level":3,"eyebrow":"08","text":"What are the noise, alcohol, and end-time restrictions?"},{"type":"paragraph","text":"Outdoor music often has to stop earlier than you''d expect. Some venues require licensed bartenders, some forbid shots, a few cap drink counts. End times of 10 p.m. are surprisingly common. None of these are deal-breakers — but they''re definitely contract-readers."},{"type":"heading","level":3,"eyebrow":"09","text":"Who will actually be there on our wedding day?"},{"type":"paragraph","text":"The friendly sales manager giving you the tour usually isn''t the person running your reception. Ask who the on-site coordinator is, what their role covers, and when you''ll meet them. If the answer is “TBD,” press for specifics in writing."},{"type":"heading","level":3,"eyebrow":"10","text":"What happens if we need to postpone or cancel?"},{"type":"paragraph","text":"Read the fine print. Look for postponement windows, blackout dates, and whether deposits transfer. Ask what happens if the venue itself has to cancel — due to construction, ownership change, or natural disaster. The contracts that protect couples best protect both sides."},{"type":"quote","text":"The right venue says yes to your questions in writing. The wrong venue says ‘don''t worry, we''ll figure it out.’","cite":"Sarah Mitchell, Lead Wedding Advisor"},{"type":"heading","level":2,"text":"The Bottom Line"},{"type":"paragraph","text":"A wedding venue contract is the single biggest commitment you''ll make in your planning process. The couples who walk away happy aren''t the ones who found the prettiest space — they''re the ones who knew exactly what they were signing."},{"type":"paragraph","text":"Print this list. Bring it on every tour. And if a venue resists giving clear written answers? That''s your answer right there."},{"type":"cta","heading":"Find venues that fit before you tour","text":"Search every venue near you by date, guest count, budget and style — then bring this list to the ones you love.","buttonLabel":"Search Venues","buttonHref":"/search"}]'::jsonb,
  'Sarah Mitchell',
  'Lead Wedding Advisor',
  '/landing/hero-video-thumbnail.jpg',
  'Sarah has helped over 600 couples plan and book their weddings across 14 states. She believes the best planning is the kind that leaves you feeling calmer, not more frazzled.',
  8,
  '10 Essential Questions to Ask Your Wedding Venue Before Booking',
  'Don''t sign a venue contract without these 10 critical questions. The must-ask checklist that protects your budget, your date, and your dream day.',
  false,
  true,
  '2026-03-18'::timestamptz)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO blog_posts (slug, title, subtitle, excerpt, category, tags, featured_image, featured_image_alt, blocks, author_name, author_role, author_image, author_bio, read_minutes, seo_title, seo_description, featured, published, published_at)
VALUES ('how-to-plan-a-wedding-step-by-step',
  'How to Plan a Wedding Step by Step',
  'A calm, complete walkthrough of every major step — in the right order. Whether you''re newly engaged or a few months in and feeling behind, this guide is your starting point.',
  'From the moment you say yes to walking down the aisle — a complete, no-fluff guide that breaks every decision into a clear, doable step.',
  'Planning',
  ARRAY['Planning', 'Budget', 'Timeline', 'Vendors', 'Guest List', 'Beginners']::text[],
  '/blog/blog-planning-hero.jpg',
  'Wedding planning workspace with notebook, peonies, and gold pen on ivory linen',
  '[{"type":"paragraph","dropCap":true,"text":"Planning a wedding sounds dreamy — until suddenly you''re staring at seventeen browser tabs, a notes app full of vendor names, and a Pinterest board that''s somehow grown to 400 pins. Where do you even start?"},{"type":"paragraph","text":"Here''s the thing: wedding planning doesn''t have to feel like chaos. When you break it down into clear, manageable steps, it starts to feel a lot more like building something beautiful — and a lot less like solving a puzzle with missing pieces."},{"type":"paragraph","text":"Whether you''re newly engaged and wide-eyed, or a few months in and feeling behind, this guide is your calm starting point. We''re going to walk through every major step, in the right order, so nothing sneaks up on you later."},{"type":"callout","variant":"info","title":"The Short Version","text":"Planning a wedding step by step starts with setting a budget, choosing a date, creating a guest list, and booking a venue — then moves into vendors, ceremony details, invitations, and your wedding-day timeline. It''s a lot, but you''ve got this."},{"type":"heading","level":2,"eyebrow":"Step 01","text":"Set Your Wedding Vision"},{"type":"paragraph","text":"Before you book a single thing, give yourself a moment to just dream. What do you actually want this day to feel like?"},{"type":"paragraph","text":"This is one of the most fun parts of planning, and it''s worth slowing down for. Your vision shapes everything — from the venue you''ll love to the vendors who are the right fit for you."},{"type":"paragraph","text":"Think through your wedding style (formal and classic? relaxed and rustic? a destination on the beach?), your size (an elopement, a micro wedding, or 150 of your favorite people?), and the season and setting that makes your heart happy."},{"type":"table","headers":["Vision Element","Questions to Ask"],"rows":[["Style","Do we want formal, casual, traditional, or modern?"],["Size","How many guests do we want?"],["Location","Local, destination, indoor, or outdoor?"],["Budget","What can we realistically spend?"],["Experience","What should guests remember most?"]]},{"type":"paragraph","text":"Don''t worry if your answers feel vague right now. Your vision will sharpen as you go. The goal is just to give yourself a starting direction — a North Star to guide your decisions."},{"type":"heading","level":2,"eyebrow":"Step 02","text":"Create a Wedding Budget"},{"type":"paragraph","text":"Let''s talk about the part that can feel a little uncomfortable: money. But here''s the truth — your budget is one of the most helpful tools you have. It''s not a limitation. It''s a roadmap."},{"type":"paragraph","text":"There''s no magic number that works for every couple. Wedding costs depend on where you live, how many guests you''re hosting, the venue, and the vendors you hire. Start with your realistic number — not what someone else spent."},{"type":"table","headers":["Category","Suggested Budget Share"],"rows":[["Venue and catering","40–50%"],["Photography and video","10–15%"],["Attire and beauty","5–10%"],["Flowers and decor","8–12%"],["Music and entertainment","5–10%"],["Invitations and stationery","2–4%"],["Planner or coordinator","5–15%"],["Miscellaneous buffer","5–10%"]]},{"type":"paragraph","text":"A few things most couples don''t realize: there are always hidden costs. Tips for vendors, dress alterations, postage, a marriage license, welcome bags. That miscellaneous buffer isn''t optional — it''s a lifesaver."},{"type":"heading","level":2,"eyebrow":"Step 03","text":"Build Your Guest List"},{"type":"paragraph","text":"Your guest list is connected to almost everything: your venue size, your catering costs, your invitation budget, even how the day feels. So it deserves its own careful thought."},{"type":"paragraph","text":"Every guest you add increases costs — more plates, more chairs, more invitations. It sounds transactional, but seeing it clearly helps. Create an A-list (must-haves) and a B-list (would love to invite if space allows). Decide on plus-ones and a kids policy early. Start collecting addresses as you go."},{"type":"paragraph","text":"And give yourself grace with this one. Guest lists can bring up complicated feelings — family dynamics, old friendships, people who expect to be included. It''s okay to be thoughtful and firm about what''s right for you."},{"type":"heading","level":2,"eyebrow":"Step 04","text":"Choose a Wedding Date"},{"type":"paragraph","text":"Your date affects everything: venue availability, travel costs for guests, weather, and even vendor pricing. Peak season (late spring through early fall) is busier and pricier. Off-peak can mean savings and flexibility."},{"type":"paragraph","text":"Think about the season that makes your heart happy, family dates to work around, traveling guests, and any meaningful religious or cultural dates. A weekday or Sunday wedding can be more budget-friendly, too."},{"type":"paragraph","text":"The most common question: should you choose the date or venue first? Choose a date range first — a season or a few preferred weekends — and confirm your exact date once you''ve checked venue availability."},{"type":"heading","level":2,"eyebrow":"Step 05","text":"Book the Wedding Venue"},{"type":"paragraph","text":"If there''s one booking that deserves top priority, it''s this one. Your venue determines your guest capacity, your date, your overall vibe, and sometimes even which vendors you can hire."},{"type":"paragraph","text":"When visiting venues, think beyond how pretty they look in photos. Ask the real questions about what''s included, capacity, catering rules, the rain plan, vendor arrival times, and parking."},{"type":"paragraph","text":"Some venues include catering, tables, chairs, and decor. Others are blank-slate spaces where you bring everything. Neither is better — they just lead to different planning processes."},{"type":"image","src":"/blog/blog-planning-budget.jpg","alt":"Couple reviewing wedding plans together at a cafe","caption":"The best planning sessions happen over coffee, not stress."},{"type":"heading","level":2,"eyebrow":"Step 06","text":"Hire Your Main Wedding Vendors"},{"type":"paragraph","text":"This is where things really start to feel real. Your vendors are the people who will make your wedding day happen — and finding ones who truly get your vision makes all the difference."},{"type":"paragraph","text":"The main vendors most couples hire: planner or coordinator, photographer, videographer, caterer, florist, DJ or band, officiant, hair and makeup, transportation, and rental companies."},{"type":"table","headers":["Vendor","When to Book"],"rows":[["Venue","12–18 months before"],["Planner","12–18 months before"],["Photographer","9–12 months before"],["Caterer","9–12 months before"],["Florist","6–9 months before"],["DJ or band","6–9 months before"],["Hair and makeup","6–9 months before"],["Transportation","3–6 months before"]]},{"type":"paragraph","text":"Finding the right vendor match feels a little like dating — you''re looking for someone whose work you love and who you click with personally. Being matched with vendors who already fit your style, budget, and vibe takes so much guesswork out of it."},{"type":"heading","level":2,"eyebrow":"Step 07","text":"Create Your Planning Timeline"},{"type":"paragraph","text":"Think of your planning timeline as your gentle guide for the next several months. It keeps you from scrambling — and from forgetting anything important."},{"type":"paragraph","text":"12 months out: set your budget, build your guest list, choose your date range, book your venue, hire a planner, research key vendors, and start dress shopping (yes, this early)."},{"type":"paragraph","text":"6 months out: send save-the-dates, book any remaining vendors, plan your decor and palette, finalize your menu, book hotel blocks, and start ceremony details."},{"type":"paragraph","text":"1 month out: finalize RSVPs, confirm every vendor, create your seating chart, finalize the day-of timeline, prepare final payments and tip envelopes, and pack your emergency kit."},{"type":"heading","level":2,"eyebrow":"Step 08","text":"Choose Your Wedding Party"},{"type":"paragraph","text":"Your wedding party is your inner circle — the people who will stand beside you, literally and figuratively, through this whole journey."},{"type":"paragraph","text":"There are no rules here. Some couples have eight on each side. Others have one maid of honor and call it done. Some skip the structure altogether. What matters is choosing people who are genuinely supportive, reliable, and excited for you."},{"type":"paragraph","text":"Beyond looking beautiful in photos, your party plays a real role: showers and bachelorette events, attire coordination, emotional support during stressful moments, and helping out on the day itself."},{"type":"heading","level":2,"eyebrow":"Step 09","text":"Plan the Ceremony"},{"type":"paragraph","text":"Your ceremony is the heart of the whole day. It''s the part people will feel in their chest long after the reception is over. Give it real love and intention."},{"type":"paragraph","text":"Think through the type of ceremony (religious, civil, spiritual, cultural), who will officiate, whether you''ll write your own vows, readings or rituals to include, your processional and recessional music, and your marriage license requirements."},{"type":"paragraph","text":"Most ceremonies follow this flow: processional, welcome, readings, vows, ring exchange, pronouncement, first kiss, recessional. You can customize this beautifully — add a unity candle, a handfasting, a cultural tradition, or a moment of silence."},{"type":"heading","level":2,"eyebrow":"Step 10","text":"Plan the Reception"},{"type":"paragraph","text":"If the ceremony is the heart, the reception is the celebration. The dancing, the laughter, the toasts that make everyone cry in the best way, the cake, that last song before the send-off."},{"type":"paragraph","text":"Every reception looks different depending on your style, venue, and vibe. The important thing is that it flows — guests are fed, entertained, and having fun — and that you actually get to enjoy it too."},{"type":"table","headers":["Time","Event"],"rows":[["5:00 PM","Ceremony"],["5:30 PM","Cocktail hour"],["6:30 PM","Grand entrance"],["6:45 PM","Dinner"],["7:30 PM","Toasts"],["8:00 PM","First dance"],["8:15 PM","Open dancing"],["9:00 PM","Cake cutting"],["10:30 PM","Last dance and send-off"]]},{"type":"heading","level":2,"eyebrow":"Step 11","text":"Choose Your Wedding Attire"},{"type":"paragraph","text":"Your wedding day look is one of those things you''ll remember forever. And so will everyone in the room when you walk in."},{"type":"paragraph","text":"Give yourself plenty of time. Wedding dresses often need 4–6 months to be ordered, plus alterations. Start shopping for dresses, suits, and tuxedos 8–12 months before. Wedding party attire: 4–6 months. Accessories and shoes once your main attire is locked in."},{"type":"paragraph","text":"Don''t forget dress code — black tie, cocktail, garden party, casual. Communicating it on save-the-dates or your wedding website helps everyone show up feeling great."},{"type":"heading","level":2,"eyebrow":"Step 12","text":"Send Save-the-Dates and Invitations"},{"type":"paragraph","text":"Save-the-dates are your early announcement — a heads-up that lets guests clear their calendars, arrange travel, and request time off."},{"type":"paragraph","text":"Send save-the-dates 6–8 months before, or up to a year for destination weddings or holiday weekends. Send formal invitations 6–8 weeks before for local guests, or 3 months out for destinations. Include an RSVP deadline 3–4 weeks before the wedding to finalize headcount with your caterer."},{"type":"heading","level":2,"eyebrow":"Step 13","text":"Create a Wedding Website"},{"type":"paragraph","text":"A wedding website is one of the most helpful things you can create — and guests genuinely appreciate having one place to find everything."},{"type":"paragraph","text":"Include: a little of your love story, ceremony and reception schedule, venue addresses with map links, dress code, travel info and hotel recommendations, your registry, your RSVP form, and FAQs (parking, kids policy, shuttle info)."},{"type":"paragraph","text":"You don''t need to be tech-savvy — there are beautiful, easy-to-use templates out there. It can go live as soon as your save-the-dates do."},{"type":"heading","level":2,"eyebrow":"Step 14","text":"Plan the Wedding Menu"},{"type":"paragraph","text":"Food is one of the most memorable parts of any wedding. Think about what kind of dining experience matches your vibe — plated, buffet, family-style, or cocktail-style stations."},{"type":"paragraph","text":"Work with your caterer to build a menu that fits your budget, guest count, dietary restrictions (vegetarian, vegan, gluten-free, allergies), and celebration style. A tasting is usually included — one of the more delicious parts of planning, honestly."},{"type":"paragraph","text":"Don''t forget the bar. Open bar, beer and wine only, signature cocktails, mocktails — decide what feels right for you and your guests."},{"type":"heading","level":2,"eyebrow":"Step 15","text":"Design the Wedding Decor"},{"type":"paragraph","text":"Decor is where your wedding''s visual personality really comes alive. It doesn''t have to be lavish to be beautiful. Even simple, thoughtful touches create something completely magical."},{"type":"paragraph","text":"Start with your color palette and build from there. Think through: ceremony arch or backdrop, aisle decor, welcome sign, seating chart display, guest book table, centerpieces, candles and lighting, table linens and place settings, place cards, bar signage, and cake table styling."},{"type":"paragraph","text":"Work closely with your florist and rental companies early so they understand your vision. Bringing photos, mood boards, or fabric swatches helps them bring it to life exactly as you imagined."},{"type":"heading","level":2,"eyebrow":"Step 16","text":"Arrange Travel and Accommodation"},{"type":"paragraph","text":"If you have guests traveling from out of town — or your wedding is a destination event — this step deserves extra attention."},{"type":"paragraph","text":"Hotel room blocks are one of the kindest things you can do for traveling guests. You negotiate a reserved block at a discounted rate, and guests book before a deadline."},{"type":"paragraph","text":"Also think through: shuttles from hotels to the venue, parking info, and welcome bags for out-of-town guests. A little local treat, a water bottle, and a printed schedule goes a long way."},{"type":"heading","level":2,"eyebrow":"Step 17","text":"Get the Marriage License"},{"type":"paragraph","text":"Easy to forget in the swirl of everything else — but this is the one that makes it all legally official."},{"type":"paragraph","text":"Requirements vary by location, so check your specific city or county. Some places have a waiting period after you apply; others have an expiration on the license itself. A safe rule: get it a few weeks before the wedding — not so early it expires, not so late you''re scrambling."},{"type":"paragraph","text":"Your officiant typically signs and submits the license after the ceremony. Confirm this with them well in advance."},{"type":"heading","level":2,"eyebrow":"Step 18","text":"Finalize the Seating Chart"},{"type":"paragraph","text":"For some couples, this is oddly fun. For others, it''s the task that makes them briefly consider eloping. Either way, it''s a puzzle worth solving thoughtfully."},{"type":"paragraph","text":"Group guests by relationship and comfort — family clusters, friend groups, work friends, college friends. Think about who will have the most fun together, and who needs more careful placement."},{"type":"paragraph","text":"Consider accessibility for elderly guests and families with small children. And make sure your caterer accounts for vendor meals — your photographer and DJ typically eat during cocktail hour."},{"type":"heading","level":2,"eyebrow":"Step 19","text":"Create the Wedding Day Timeline"},{"type":"paragraph","text":"Your wedding-day timeline is the document that holds everything together. It''s your coordinator''s bible, your vendor''s guide, and your peace of mind."},{"type":"paragraph","text":"Share it with everyone working your wedding: planner, venue manager, photographer, videographer, DJ or band, caterer, florist, transportation, officiant, wedding party, and family helping coordinate."},{"type":"paragraph","text":"A good timeline includes hair and makeup start times, the first look, ceremony start, family photo groupings, cocktail hour, reception flow, and cleanup. Build in small buffers — things rarely run exactly on schedule, and that''s okay."},{"type":"heading","level":2,"eyebrow":"Step 20","text":"Confirm Every Vendor"},{"type":"paragraph","text":"In the week or two before the wedding, reach out to every single vendor to confirm details one final time. It feels like overkill — it''s not."},{"type":"paragraph","text":"Confirm: arrival time and location, contact name and phone, final payment amount and method, specific setup needs, deliverables, meal requirements for vendors who get one, and emergency contacts."},{"type":"paragraph","text":"A quick email or call takes ten minutes and prevents a lot of \"wait, where did they say to park?\" energy on the actual day."},{"type":"heading","level":2,"eyebrow":"Step 21","text":"Prepare a Wedding Emergency Kit"},{"type":"paragraph","text":"Every bride and wedding party member quietly becomes a hero the day someone asks \"does anyone have a safety pin?\" Spoiler: you will."},{"type":"paragraph","text":"Pack a small bag with: safety pins, a sewing kit, stain remover pen, pain reliever, bandages, tissues, breath mints, phone charger and portable battery, snacks and a water bottle, and makeup touch-up essentials."},{"type":"paragraph","text":"It sounds like a lot — but it fits in a tote bag and will absolutely be used. Trust on this one."},{"type":"heading","level":2,"eyebrow":"Step 22","text":"Enjoy the Wedding Day"},{"type":"paragraph","text":"This one sounds obvious. It''s actually the hardest step for many couples."},{"type":"paragraph","text":"Your wedding day will not be perfect. Something small will go sideways — a flower arrangement will look different than you imagined, the timeline will run a few minutes behind, it might drizzle when you didn''t want it to. And none of it will matter."},{"type":"paragraph","text":"What you''ll remember is the way your partner looked at you. The toast that made your whole table cry. Your grandmother dancing to a song she didn''t expect to love. The moment you walked back up the aisle as a married couple."},{"type":"paragraph","text":"Delegate. Trust your vendors. Eat and drink water. Stay present — put your phone down sometimes. Expect imperfection, and embrace it. The unplanned moments are often the ones you''ll love most."},{"type":"quote","text":"Take it one step at a time. Ask for help when you need it. And give yourself permission to enjoy this — even the messy, overwhelming, can''t-find-the-right-florist parts of it.","cite":"Sarah Mitchell, Lead Wedding Advisor"},{"type":"heading","level":2,"text":"Common Wedding Planning Mistakes to Avoid"},{"type":"paragraph","text":"Even the most organized couples can trip over a few of these. Consider this a gentle heads-up."},{"type":"checklist","items":["Starting without a clear budget (and sticking to it)","Booking vendors before locking in a venue — the venue drives so many decisions","Inviting too many guests to fit your real budget","Forgetting hidden costs like tips, alterations, and postage","Not reading vendor contracts before signing","Skipping a weather backup plan for outdoor weddings","Assuming someone else is handling logistics without confirming","Building a timeline with no buffer for the unexpected","Focusing so much on the details that guest experience slips"]},{"type":"paragraph","text":"None of these are catastrophes if they happen — they''re just easier to avoid than to fix. And now you know to watch for them."},{"type":"heading","level":2,"text":"Wedding Planning FAQs"},{"type":"faq","items":[{"q":"What is the first step in planning a wedding?","a":"The first step is getting clear on your vision and your budget. Those two things shape every decision that follows — from your guest list to your venue to the vendors you''ll love."},{"q":"How long does it take to plan a wedding?","a":"Most couples plan over 12 to 18 months, which allows plenty of time to book popular vendors and handle logistics without rushing. Smaller or more intimate weddings can come together in 3 to 6 months with flexible vendors and a streamlined guest list."},{"q":"What are the most important steps in planning a wedding?","a":"Setting your budget, building your guest list, booking your venue, and hiring your key vendors — those are the heavy lifters. Everything else builds naturally from those foundations."},{"q":"Can you plan a wedding without a planner?","a":"Yes — many couples do it beautifully. If a full planner feels like too much, consider a day-of or month-of coordinator. They step in to manage vendors, timelines, and logistics so you can actually be present on your wedding day."},{"q":"What should be booked first?","a":"Your venue. It sets your date, your guest capacity, and your location — and it fills up fast. Once your venue is locked in, everything else starts to fall into place."}]},{"type":"heading","level":2,"text":"The Bottom Line"},{"type":"paragraph","text":"Planning a wedding is a lot. But it''s also one of those rare seasons in life where you get to make something truly and completely yours — a day that reflects who you are and how much you love each other."},{"type":"paragraph","text":"Take it one step at a time. Ask for help when you need it. And give yourself permission to enjoy this, even the messy, overwhelming, can''t-find-the-right-florist parts of it. Because the day you''ve been planning toward? It''s going to be so worth it."},{"type":"cta","heading":"Skip the Overwhelm. Start with the Right Vendors.","text":"Describe your wedding once and see every venue and vendor that fits your date, budget and style — best matches first.","buttonLabel":"Start Your Search","buttonHref":"/search"}]'::jsonb,
  'Sarah Mitchell',
  'Lead Wedding Advisor',
  '/landing/hero-video-thumbnail.jpg',
  'Sarah has helped over 600 couples plan and book their weddings across 14 states. She believes the best planning is the kind that leaves you feeling calmer, not more frazzled.',
  14,
  'How to Plan a Wedding Step by Step',
  'A calm, step-by-step guide to planning your wedding — from setting your vision and budget to building your day-of timeline. Everything in the right order, nothing left out.',
  true,
  true,
  '2026-04-22'::timestamptz)
ON CONFLICT (slug) DO NOTHING;


-- ===== 0008_vendor_accounts.sql =====
-- Vendor accounts (venues + vendors) and listing claims.
-- A user is either a couple or a vendor; one email can't be both (users.email is unique).
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'couple';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('couple', 'vendor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Claims are approved by hand for now:
--   UPDATE listing_claims SET status = 'approved', reviewed_at = now() WHERE id = '...';
CREATE TABLE IF NOT EXISTS listing_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_type text NOT NULL CHECK (listing_type IN ('venue', 'vendor')),
  listing_id text NOT NULL,
  claimant_name text NOT NULL,
  claimant_role text NOT NULL,
  claimant_phone text NOT NULL,
  note text CHECK (char_length(note) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_type, listing_id)
);
-- Only one approved owner per listing.
CREATE UNIQUE INDEX IF NOT EXISTS listing_claims_one_owner ON listing_claims (listing_type, listing_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS listing_claims_user_idx ON listing_claims (user_id, status);


-- ===== 0009_vendor_leads.sql =====
-- Vendor leads: lead prices, purchases and the wallet ledger.

-- What a vendor pays to purchase one connection request. Venues have one price
-- (category '*'); vendors have one row per category, with '*' as the fallback
-- for categories that don't have their own row yet. Change a price with:
--   UPDATE lead_prices SET price_cents = 1000, updated_at = now() WHERE listing_type = 'vendor' AND category = 'photographer';
CREATE TABLE IF NOT EXISTS lead_prices (
  listing_type text NOT NULL CHECK (listing_type IN ('venue', 'vendor')),
  -- lower(btrim(category)) of the listing, or '*'
  category text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_type, category)
);
INSERT INTO lead_prices (listing_type, category, price_cents) VALUES ('venue', '*', 500), ('vendor', '*', 500)
ON CONFLICT (listing_type, category) DO NOTHING;
INSERT INTO lead_prices (listing_type, category, price_cents)
SELECT DISTINCT 'vendor', lower(btrim(category)), 500 FROM vendors WHERE nullif(btrim(category), '') IS NOT NULL
ON CONFLICT (listing_type, category) DO NOTHING;

-- One purchase per connection request; the buyer is the listing's approved owner.
CREATE TABLE IF NOT EXISTS lead_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES connection_requests(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_purchases_user_idx ON lead_purchases (user_id, created_at DESC);

-- Wallet ledger: the balance is the sum of amount_cents. Credit only; refunds are handled by support.
-- Add credit by hand with:
--   INSERT INTO wallet_transactions (user_id, amount_cents, kind, description)
--   SELECT id, 2500, 'adjustment', 'Credit from support' FROM users WHERE email = 'vendor@example.com';
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  kind text NOT NULL CHECK (kind IN ('top_up', 'purchase', 'adjustment')),
  description text,
  lead_purchase_id uuid REFERENCES lead_purchases(id) ON DELETE SET NULL,
  stripe_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON wallet_transactions (user_id, created_at DESC);


-- ===== 0010_signup_notifications.sql =====
-- Sign-up notifications: each new account emails the team once.
-- Existing accounts are stamped now() so only sign-ups after this migration send a notice;
-- the default is then dropped so new accounts start NULL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_notified_at timestamptz DEFAULT now();
ALTER TABLE users ALTER COLUMN signup_notified_at DROP DEFAULT;


-- ===== 0011_listing_requests.sql =====
-- Vendor "Request to Add" listings. The listing row is inserted with status 'pending' (hidden everywhere),
-- along with a pending claim for the requester. Review in Neon with:
--   SELECT approve_listing_request('<request id>');  -- listing goes live, requester becomes the owner
--   SELECT reject_listing_request('<request id>');
CREATE TABLE IF NOT EXISTS listing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_type text NOT NULL CHECK (listing_type IN ('venue', 'vendor')),
  listing_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (listing_type, listing_id)
);
CREATE INDEX IF NOT EXISTS listing_requests_user_status_idx ON listing_requests (user_id, status);

CREATE OR REPLACE FUNCTION review_listing_request(request_id uuid, decision text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  r listing_requests%ROWTYPE;
  listing_status text := CASE decision WHEN 'approved' THEN 'active' ELSE 'hidden' END;
BEGIN
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'decision must be approved or rejected';
  END IF;
  SELECT * INTO r FROM listing_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No listing request with id %', request_id;
  END IF;
  IF r.listing_type = 'venue' THEN
    UPDATE venues SET status = listing_status, updated_at = now() WHERE id = r.listing_id::integer;
  ELSE
    UPDATE vendors SET status = listing_status, updated_at = now() WHERE id = r.listing_id::uuid;
  END IF;
  UPDATE listing_requests SET status = decision, reviewed_at = now() WHERE id = request_id;
  UPDATE listing_claims SET status = decision, reviewed_at = now()
    WHERE user_id = r.user_id AND listing_type = r.listing_type AND listing_id = r.listing_id;
  RETURN CASE decision WHEN 'approved' THEN 'Approved: the listing is live and the requester owns it.'
    ELSE 'Rejected: the listing stays hidden.' END;
END $$;

CREATE OR REPLACE FUNCTION approve_listing_request(request_id uuid) RETURNS text
LANGUAGE sql AS $$ SELECT review_listing_request(request_id, 'approved') $$;

CREATE OR REPLACE FUNCTION reject_listing_request(request_id uuid) RETURNS text
LANGUAGE sql AS $$ SELECT review_listing_request(request_id, 'rejected') $$;


-- ===== 0012_catering_plural.sql =====
-- Normalize the vendor category "catering_food_drink" to the plural "catering_food_drinks"
-- (any case / stray spaces). Safe to run more than once.
UPDATE public.vendors SET category = 'catering_food_drinks'
WHERE lower(btrim(category)) IN ('catering_food_drink', 'catering_food_drinks') AND category <> 'catering_food_drinks';
UPDATE public.venues SET category = 'catering_food_drinks'
WHERE lower(btrim(category)) IN ('catering_food_drink', 'catering_food_drinks') AND category <> 'catering_food_drinks';

-- Lead prices: keep the plural price if one exists, otherwise carry the singular price over.
INSERT INTO public.lead_prices (listing_type, category, price_cents)
SELECT listing_type, 'catering_food_drinks', price_cents FROM public.lead_prices WHERE category = 'catering_food_drink'
ON CONFLICT (listing_type, category) DO NOTHING;
DELETE FROM public.lead_prices WHERE category = 'catering_food_drink';

-- Saved searches that picked the singular.
UPDATE public.saved_searches
SET query = jsonb_set(query, '{qs}', to_jsonb(regexp_replace(query->>'qs', '(^|&)category=catering_food_drink(&|$)', '\1category=catering_food_drinks\2', 'gi')))
WHERE query->>'qs' ~* '(^|&)category=catering_food_drink(&|$)';

-- Check: should return one row, catering_food_drinks.
SELECT category, count(*) FROM public.vendors WHERE lower(btrim(category)) LIKE 'catering_food_drink%' GROUP BY category;


-- ===== 0013_advisor_requests.sql =====
-- "Let a wedding advisor find the perfect venue for you" form on /search ($99 per category advisor service).
-- Standalone on purpose: no links to users or listings. See new requests with:
--   SELECT * FROM advisor_requests ORDER BY created_at DESC;
CREATE TABLE IF NOT EXISTS advisor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) <= 200),
  email text NOT NULL CHECK (char_length(email) <= 200),
  phone text NOT NULL CHECK (char_length(phone) <= 40),
  message text CHECK (char_length(message) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS advisor_requests_created_idx ON advisor_requests (created_at DESC);


-- ===== 0014_deleted_listings.sql =====
-- One row per listing deleted from Admin → Listings: a full copy of the venue/vendor row plus the
-- claims, add requests and photo URLs removed with it, so a mistaken delete can be restored by hand.
CREATE TABLE IF NOT EXISTS deleted_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_type text NOT NULL CHECK (listing_type IN ('venue', 'vendor')),
  listing_id text NOT NULL,
  name text,
  listing jsonb NOT NULL,
  related jsonb NOT NULL DEFAULT '{}',
  deleted_by text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deleted_listings_deleted_idx ON deleted_listings (deleted_at DESC);
