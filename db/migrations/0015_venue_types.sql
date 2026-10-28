-- Standardize venues.venue_type into a short list of groups.
-- Whatever is written to venue_type (by n8n, SQL or the app) is copied to venue_type_raw and
-- venue_type is rewritten as a ", " list of group names, using venue_type_map. Safe to run more than once.

CREATE TABLE IF NOT EXISTS venue_type_groups (
  name text PRIMARY KEY,
  sort_order integer NOT NULL
);

INSERT INTO venue_type_groups (name, sort_order) VALUES
  ('Hotel & Resort', 1), ('Banquet & Event Hall', 2), ('Ballroom', 3), ('Barn, Farm & Ranch', 4),
  ('Garden & Park', 5), ('Beach & Waterfront', 6), ('Yacht & Boat', 7), ('Country & Golf Club', 8),
  ('Restaurant & Bar', 9), ('Winery & Vineyard', 10), ('Estate & Historic', 11), ('Chapel & Church', 12),
  ('Museum, Gallery & Studio', 13), ('Conference Center', 14), ('Unique Venues', 15)
ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order;

-- raw_type is lowercase without quotes/braces. A raw type can belong to several groups.
-- group_name NULL = known type that belongs to no group (e.g. bowling alley).
CREATE TABLE IF NOT EXISTS venue_type_map (
  raw_type text NOT NULL,
  group_name text REFERENCES venue_type_groups (name) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS venue_type_map_unique ON venue_type_map (raw_type, coalesce(group_name, ''));

INSERT INTO venue_type_map (raw_type, group_name)
SELECT m.raw_type, m.group_name FROM (VALUES
  ('hotel', 'Hotel & Resort'), ('resort', 'Hotel & Resort'), ('lodge', 'Hotel & Resort'), ('inn', 'Hotel & Resort'),
  ('b&b', 'Hotel & Resort'), ('bed & breakfast', 'Hotel & Resort'), ('bed and breakfast', 'Hotel & Resort'),
  ('boutique hotel', 'Hotel & Resort'), ('hotel resort', 'Hotel & Resort'), ('hotel resort lodge', 'Hotel & Resort'),
  ('hotel & resort', 'Hotel & Resort'),
  ('hotel resort with ballroom', 'Hotel & Resort'), ('hotel resort with ballroom', 'Ballroom'),
  ('hotel ballroom', 'Hotel & Resort'), ('hotel ballroom', 'Ballroom'),
  ('hotel event space', 'Hotel & Resort'), ('hotel event space', 'Banquet & Event Hall'),
  ('hotel conference center', 'Hotel & Resort'), ('hotel conference center', 'Conference Center'),
  ('hotel resort convention center', 'Hotel & Resort'), ('hotel resort convention center', 'Conference Center'),
  ('golf club resort', 'Hotel & Resort'), ('golf club resort', 'Country & Golf Club'),

  ('event hall', 'Banquet & Event Hall'), ('banquet', 'Banquet & Event Hall'), ('banquet hall', 'Banquet & Event Hall'),
  ('banquet space', 'Banquet & Event Hall'), ('banquet facility', 'Banquet & Event Hall'),
  ('event space', 'Banquet & Event Hall'), ('event center', 'Banquet & Event Hall'), ('event venue', 'Banquet & Event Hall'),
  ('community center', 'Banquet & Event Hall'), ('rooftop event hall', 'Banquet & Event Hall'),
  ('reception hall', 'Banquet & Event Hall'), ('rooftop', 'Banquet & Event Hall'), ('banquet & event hall', 'Banquet & Event Hall'),

  ('ballroom', 'Ballroom'),

  ('barn', 'Barn, Farm & Ranch'), ('farm', 'Barn, Farm & Ranch'), ('farmhouse', 'Barn, Farm & Ranch'),
  ('ranch', 'Barn, Farm & Ranch'), ('farm & ranch', 'Barn, Farm & Ranch'),

  ('garden', 'Garden & Park'), ('park', 'Garden & Park'), ('botanical garden', 'Garden & Park'), ('garden & park', 'Garden & Park'),

  ('beach', 'Beach & Waterfront'), ('beach house', 'Beach & Waterfront'), ('waterfront', 'Beach & Waterfront'),
  ('marina', 'Beach & Waterfront'), ('oceanfront', 'Beach & Waterfront'), ('beach & waterfront', 'Beach & Waterfront'),
  ('waterfront estate', 'Beach & Waterfront'), ('waterfront estate', 'Estate & Historic'),

  ('yacht', 'Yacht & Boat'), ('yacht club', 'Yacht & Boat'), ('yacht charter', 'Yacht & Boat'), ('boat', 'Yacht & Boat'),
  ('boat charter', 'Yacht & Boat'), ('yacht & boat', 'Yacht & Boat'),

  ('country club', 'Country & Golf Club'), ('golf club', 'Country & Golf Club'), ('golf course', 'Country & Golf Club'),
  ('clubhouse', 'Country & Golf Club'), ('country & golf club', 'Country & Golf Club'),

  ('restaurant', 'Restaurant & Bar'), ('bar', 'Restaurant & Bar'), ('pub', 'Restaurant & Bar'), ('lounge', 'Restaurant & Bar'),
  ('nightclub', 'Restaurant & Bar'), ('brewery', 'Restaurant & Bar'), ('wine bar', 'Restaurant & Bar'),
  ('restaurant & bar', 'Restaurant & Bar'),

  ('winery', 'Winery & Vineyard'), ('vineyard', 'Winery & Vineyard'), ('winery & vineyard', 'Winery & Vineyard'),

  ('estate', 'Estate & Historic'), ('mansion', 'Estate & Historic'), ('historic', 'Estate & Historic'),
  ('historic landmark', 'Estate & Historic'), ('estate & historic', 'Estate & Historic'),

  ('chapel', 'Chapel & Church'), ('wedding chapel', 'Chapel & Church'), ('church', 'Chapel & Church'),
  ('religious', 'Chapel & Church'), ('religious chapel', 'Chapel & Church'), ('chapel & church', 'Chapel & Church'),

  ('museum', 'Museum, Gallery & Studio'), ('gallery', 'Museum, Gallery & Studio'), ('art gallery', 'Museum, Gallery & Studio'),
  ('studio', 'Museum, Gallery & Studio'), ('loft', 'Museum, Gallery & Studio'), ('theater', 'Museum, Gallery & Studio'),
  ('theatre', 'Museum, Gallery & Studio'), ('auditorium', 'Museum, Gallery & Studio'), ('gallery & studio', 'Museum, Gallery & Studio'),

  ('conference', 'Conference Center'), ('meeting', 'Conference Center'), ('meeting room', 'Conference Center'),
  ('meeting space', 'Conference Center'), ('conference center', 'Conference Center'), ('convention center', 'Conference Center'),

  ('zoo', 'Unique Venues'), ('aquarium', 'Unique Venues'), ('retreat center', 'Unique Venues'), ('cabin', 'Unique Venues'),
  ('campground', 'Unique Venues'), ('university', 'Unique Venues'), ('stadium', 'Unique Venues'), ('casino', 'Unique Venues'),
  ('unique venues', 'Unique Venues'),

  ('bowling', NULL), ('bowling alley', NULL), ('fun zone', NULL), ('indoor playground', NULL), ('sports facility', NULL),
  ('school', NULL), ('dance studio', NULL), ('entertainment center', NULL), ('entertainment venue', NULL)
) AS m (raw_type, group_name)
ON CONFLICT DO NOTHING;

-- One raw type, cleaned: lowercase, no quotes/braces/brackets, single spaces.
CREATE OR REPLACE FUNCTION ws_venue_type_token(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(btrim(regexp_replace(lower(regexp_replace(coalesce(t, ''), '[{}"\[\]]', '', 'g')), '\s+', ' ', 'g')), '')
$$;

-- Raw types split on , ; | / and mapped to group names, in the standard order.
CREATE OR REPLACE FUNCTION ws_normalize_venue_type(raw text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT string_agg(g.name, ', ' ORDER BY g.sort_order)
  FROM venue_type_groups g
  WHERE EXISTS (
    SELECT 1 FROM regexp_split_to_table(coalesce(raw, ''), '\s*[,;|/]\s*') AS t
    JOIN venue_type_map m ON m.raw_type = ws_venue_type_token(t)
    WHERE m.group_name = g.name
  )
$$;

ALTER TABLE venues ADD COLUMN IF NOT EXISTS venue_type_raw text;

CREATE OR REPLACE FUNCTION ws_venue_type_before_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  normalized text;
BEGIN
  normalized := ws_normalize_venue_type(NEW.venue_type);
  -- Already-standard values (e.g. re-saved by the app) keep the original raw text.
  IF NEW.venue_type IS DISTINCT FROM normalized THEN
    NEW.venue_type_raw := NEW.venue_type;
  END IF;
  NEW.venue_type := normalized;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venues_venue_type ON venues;
CREATE TRIGGER venues_venue_type BEFORE INSERT OR UPDATE OF venue_type ON venues
  FOR EACH ROW EXECUTE FUNCTION ws_venue_type_before_write();

-- Convert existing rows; re-running after adding to venue_type_map re-converts from the raw text.
UPDATE venues SET venue_type = coalesce(venue_type_raw, venue_type)
WHERE coalesce(venue_type_raw, venue_type) IS NOT NULL
  AND venue_type IS DISTINCT FROM ws_normalize_venue_type(coalesce(venue_type_raw, venue_type));

-- The old "Setting" filter is replaced by the Venue type picker.
UPDATE app_config
SET value = coalesce((SELECT jsonb_agg(f) FROM jsonb_array_elements(value) AS f WHERE f->>'key' <> 'setting'), '[]'::jsonb),
    updated_at = now()
WHERE key = 'filters' AND jsonb_typeof(value) = 'array' AND value @> '[{"key": "setting"}]';
