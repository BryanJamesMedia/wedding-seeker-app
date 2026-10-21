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
