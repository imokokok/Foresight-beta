-- Add Chinese categories for Crypto and More, and normalize prediction categories

INSERT INTO public.categories (name)
VALUES
  ('加密货币'),
  ('更多')
ON CONFLICT (name) DO NOTHING;

UPDATE public.predictions
SET category = '加密货币'
WHERE category = 'crypto';

UPDATE public.predictions
SET category = '更多'
WHERE category = 'more';

