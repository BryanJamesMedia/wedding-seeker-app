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
