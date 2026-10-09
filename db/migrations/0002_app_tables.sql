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
