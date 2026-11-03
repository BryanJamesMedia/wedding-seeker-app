-- My Wedding: search radius, a free-text date when the exact date isn't known, and the venue types wanted.
ALTER TABLE wedding_profiles ADD COLUMN IF NOT EXISTS radius_miles integer CHECK (radius_miles IN (10, 25, 50, 100));
ALTER TABLE wedding_profiles ADD COLUMN IF NOT EXISTS date_text text CHECK (char_length(date_text) <= 100);
ALTER TABLE wedding_profiles ADD COLUMN IF NOT EXISTS venue_types text[] NOT NULL DEFAULT '{}';
