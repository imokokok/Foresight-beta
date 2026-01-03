SELECT rarity, count(*) as count 
FROM public.emojis 
GROUP BY rarity 
ORDER BY 
  CASE rarity 
    WHEN 'common' THEN 1 
    WHEN 'rare' THEN 2 
    WHEN 'epic' THEN 3 
    WHEN 'legendary' THEN 4 
  END;
