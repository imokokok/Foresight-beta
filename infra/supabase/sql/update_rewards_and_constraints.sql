-- 1. Remove the trigger and function to prevent double rewarding
DROP TRIGGER IF EXISTS on_checkin_created ON public.flag_checkins;
DROP FUNCTION IF EXISTS public.reward_emoji_on_checkin();

-- 2. Update emojis table constraint to allow 'epic' rarity
-- Drop existing check constraints on rarity column
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.emojis'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%rarity%'
  LOOP
    EXECUTE 'ALTER TABLE public.emojis DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END
$$;

-- Add the new constraint including 'epic'
ALTER TABLE public.emojis
  ADD CONSTRAINT emojis_rarity_check
  CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'));

-- 3. Insert sample epic emojis (optional, using dummy URLs)
INSERT INTO public.emojis (name, image_url, rarity, description)
SELECT 'Epic Star', 'https://placeholder.com/epic-star.png', 'epic', 'An epic star reward'
WHERE NOT EXISTS (
    SELECT 1 FROM public.emojis WHERE name = 'Epic Star'
);

INSERT INTO public.emojis (name, image_url, rarity, description)
SELECT 'Epic Heart', 'https://placeholder.com/epic-heart.png', 'epic', 'An epic heart reward'
WHERE NOT EXISTS (
    SELECT 1 FROM public.emojis WHERE name = 'Epic Heart'
);
