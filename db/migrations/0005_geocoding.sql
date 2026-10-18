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
