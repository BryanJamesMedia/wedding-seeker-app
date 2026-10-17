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
