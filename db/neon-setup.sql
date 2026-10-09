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
