-- Normalize the vendor category "catering_food_drink" to the plural "catering_food_drinks"
-- (any case / stray spaces). Safe to run more than once.
UPDATE public.vendors SET category = 'catering_food_drinks'
WHERE lower(btrim(category)) IN ('catering_food_drink', 'catering_food_drinks') AND category <> 'catering_food_drinks';
UPDATE public.venues SET category = 'catering_food_drinks'
WHERE lower(btrim(category)) IN ('catering_food_drink', 'catering_food_drinks') AND category <> 'catering_food_drinks';

-- Lead prices: keep the plural price if one exists, otherwise carry the singular price over.
INSERT INTO public.lead_prices (listing_type, category, price_cents)
SELECT listing_type, 'catering_food_drinks', price_cents FROM public.lead_prices WHERE category = 'catering_food_drink'
ON CONFLICT (listing_type, category) DO NOTHING;
DELETE FROM public.lead_prices WHERE category = 'catering_food_drink';

-- Saved searches that picked the singular.
UPDATE public.saved_searches
SET query = jsonb_set(query, '{qs}', to_jsonb(regexp_replace(query->>'qs', '(^|&)category=catering_food_drink(&|$)', '\1category=catering_food_drinks\2', 'gi')))
WHERE query->>'qs' ~* '(^|&)category=catering_food_drink(&|$)';

-- Check: should return one row, catering_food_drinks.
SELECT category, count(*) FROM public.vendors WHERE lower(btrim(category)) LIKE 'catering_food_drink%' GROUP BY category;
