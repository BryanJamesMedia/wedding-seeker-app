-- Vendor leads: lead prices, purchases and the wallet ledger.

-- What a vendor pays to purchase one connection request. Venues have one price
-- (category '*'); vendors have one row per category, with '*' as the fallback
-- for categories that don't have their own row yet. Change a price with:
--   UPDATE lead_prices SET price_cents = 1000, updated_at = now() WHERE listing_type = 'vendor' AND category = 'photographer';
CREATE TABLE IF NOT EXISTS lead_prices (
  listing_type text NOT NULL CHECK (listing_type IN ('venue', 'vendor')),
  -- lower(btrim(category)) of the listing, or '*'
  category text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_type, category)
);
INSERT INTO lead_prices (listing_type, category, price_cents) VALUES ('venue', '*', 500), ('vendor', '*', 500)
ON CONFLICT (listing_type, category) DO NOTHING;
INSERT INTO lead_prices (listing_type, category, price_cents)
SELECT DISTINCT 'vendor', lower(btrim(category)), 500 FROM vendors WHERE nullif(btrim(category), '') IS NOT NULL
ON CONFLICT (listing_type, category) DO NOTHING;

-- One purchase per connection request; the buyer is the listing's approved owner.
CREATE TABLE IF NOT EXISTS lead_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES connection_requests(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_purchases_user_idx ON lead_purchases (user_id, created_at DESC);

-- Wallet ledger: the balance is the sum of amount_cents. Credit only; refunds are handled by support.
-- Add credit by hand with:
--   INSERT INTO wallet_transactions (user_id, amount_cents, kind, description)
--   SELECT id, 2500, 'adjustment', 'Credit from support' FROM users WHERE email = 'vendor@example.com';
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  kind text NOT NULL CHECK (kind IN ('top_up', 'purchase', 'adjustment')),
  description text,
  lead_purchase_id uuid REFERENCES lead_purchases(id) ON DELETE SET NULL,
  stripe_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON wallet_transactions (user_id, created_at DESC);
