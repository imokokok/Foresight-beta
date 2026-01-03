-- 更新 emoji 表情包的稀有度分布
-- 目标：减少 Common 占比，增加 Rare/Epic/Legendary
-- 策略：对名字以 'emoji' 开头的通用表情包进行随机升档

UPDATE public.emojis
SET rarity = CASE 
    -- 5% 概率变为传说
    WHEN random() < 0.05 THEN 'legendary'
    -- 15% 概率变为史诗
    WHEN random() < 0.20 THEN 'epic'
    -- 30% 概率变为稀有
    WHEN random() < 0.50 THEN 'rare'
    -- 剩余 50% 保持普通
    ELSE 'common'
END
WHERE name LIKE 'emoji%' AND rarity = 'common';

-- 也可以手动指定一些看起来比较厉害的表情包升级（如果有特定名字的话）
-- 这里先只做随机分布调整

-- 验证更新后的分布
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
