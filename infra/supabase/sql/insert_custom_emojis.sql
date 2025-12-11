-- 批量插入自定义表情包 SQL 模板
-- 使用说明：
-- 1. 在 Supabase Dashboard -> Storage 创建一个名为 'emojis' 的公开 Bucket (Public Bucket)
-- 2. 将你的表情包图片上传到该 Bucket
-- 3. 获取每张图片的 Public URL
-- 4. 替换下方 VALUES 中的示例数据
-- 5. 在 Supabase SQL Editor 中运行此脚本

INSERT INTO public.emojis (name, url, rarity, description) 
VALUES 
  -- 格式: ('名称', '图片链接', '稀有度', '描述')
  -- 稀有度可选: 'common' (普通), 'rare' (稀有), 'legendary' (传说)
  
  -- 示例数据 (请替换)
  ('摸鱼猫猫', 'https://你的supabase项目地址/storage/v1/object/public/emojis/cat.png', 'common', '今天也是努力摸鱼的一天'),
  ('强壮狗头', 'https://你的supabase项目地址/storage/v1/object/public/emojis/doge.png', 'rare', '坚持就是胜利'),
  ('至尊皇冠', 'https://你的supabase项目地址/storage/v1/object/public/emojis/crown.png', 'legendary', 'Flag之王的象征')

ON CONFLICT DO NOTHING;

-- 验证插入结果
SELECT * FROM public.emojis ORDER BY created_at DESC LIMIT 10;
