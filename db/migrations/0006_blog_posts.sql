-- Blog posts. Insert rows directly (Neon SQL Editor). One row = one post at /blog/<slug>.
-- Body is `blocks`: a JSON array of content blocks rendered in order. Block types:
--   {"type":"paragraph","text":"Supports **bold**, *italic* and [links](/search).","dropCap":false}
--   {"type":"heading","text":"Section title","level":2,"eyebrow":"Step 01"}
--   {"type":"image","src":"https://...jpg","alt":"Describe the photo","caption":"Optional","aspect":"wide|square|portrait"}
--   {"type":"imageText","layout":"imageLeft|imageRight","src":"...","alt":"...","heading":"Optional","text":"..."}
--   {"type":"steps","items":[{"title":"...","text":"..."}]}
--   {"type":"checklist","title":"Optional","items":["...","..."]}
--   {"type":"table","headers":["A","B"],"rows":[["1","2"]],"caption":"Optional"}
--   {"type":"callout","variant":"tip|info|warning","title":"Optional","text":"..."}
--   {"type":"quote","text":"...","cite":"Optional — who said it"}
--   {"type":"faq","items":[{"q":"Question?","a":"Answer."}]}
--   {"type":"cta","heading":"...","text":"Optional","buttonLabel":"Start Your Search","buttonHref":"/search"}
-- Unknown block types are skipped, so a typo never breaks the page.

CREATE TABLE IF NOT EXISTS blog_posts (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL,
  subtitle text,
  excerpt text,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  featured_image text,
  featured_image_alt text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
  author_name text,
  author_role text,
  author_image text,
  author_bio text,
  read_minutes integer CHECK (read_minutes > 0),
  seo_title text,
  seo_description text,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON blog_posts (published_at DESC) WHERE published;
CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON blog_posts (lower(category)) WHERE published;

CREATE OR REPLACE FUNCTION ws_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blog_posts_touch ON blog_posts;
CREATE TRIGGER blog_posts_touch BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION ws_touch_updated_at();
