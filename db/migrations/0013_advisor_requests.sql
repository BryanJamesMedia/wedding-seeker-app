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
