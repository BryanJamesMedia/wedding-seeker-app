-- Vendor "Request to Add" listings. The listing row is inserted with status 'pending' (hidden everywhere),
-- along with a pending claim for the requester. Review in Neon with:
--   SELECT approve_listing_request('<request id>');  -- listing goes live, requester becomes the owner
--   SELECT reject_listing_request('<request id>');
CREATE TABLE IF NOT EXISTS listing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_type text NOT NULL CHECK (listing_type IN ('venue', 'vendor')),
  listing_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (listing_type, listing_id)
);
CREATE INDEX IF NOT EXISTS listing_requests_user_status_idx ON listing_requests (user_id, status);

CREATE OR REPLACE FUNCTION review_listing_request(request_id uuid, decision text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  r listing_requests%ROWTYPE;
  listing_status text := CASE decision WHEN 'approved' THEN 'active' ELSE 'hidden' END;
BEGIN
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'decision must be approved or rejected';
  END IF;
  SELECT * INTO r FROM listing_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No listing request with id %', request_id;
  END IF;
  IF r.listing_type = 'venue' THEN
    UPDATE venues SET status = listing_status, updated_at = now() WHERE id = r.listing_id::integer;
  ELSE
    UPDATE vendors SET status = listing_status, updated_at = now() WHERE id = r.listing_id::uuid;
  END IF;
  UPDATE listing_requests SET status = decision, reviewed_at = now() WHERE id = request_id;
  UPDATE listing_claims SET status = decision, reviewed_at = now()
    WHERE user_id = r.user_id AND listing_type = r.listing_type AND listing_id = r.listing_id;
  RETURN CASE decision WHEN 'approved' THEN 'Approved: the listing is live and the requester owns it.'
    ELSE 'Rejected: the listing stays hidden.' END;
END $$;

CREATE OR REPLACE FUNCTION approve_listing_request(request_id uuid) RETURNS text
LANGUAGE sql AS $$ SELECT review_listing_request(request_id, 'approved') $$;

CREATE OR REPLACE FUNCTION reject_listing_request(request_id uuid) RETURNS text
LANGUAGE sql AS $$ SELECT review_listing_request(request_id, 'rejected') $$;
