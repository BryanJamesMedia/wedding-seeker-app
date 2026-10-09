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
  pinecone_id text,
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
  pinecone_id text,
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
