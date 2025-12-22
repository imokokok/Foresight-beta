
SELECT setval(
  pg_get_serial_sequence('public.predictions', 'id'),
  COALESCE((SELECT MAX(id) FROM public.predictions), 1)
);

-- 1) Crypto events
WITH new_event AS (
  INSERT INTO public.predictions (
    title,
    description,
    category,
    deadline,
    min_stake,
    criteria,
    image_url,
    reference_url,
    status,
    type,
    outcome_count,
    followers_count,
    created_at,
    updated_at
  )
  VALUES (
    '比特币在本季度是否刷新历史新高？',
    '观察主流交易所 BTC 现货价格，统计当前自然季度内是否出现历史最高价的新高。',
    'crypto',
    NOW() + INTERVAL '20 days',
    10,
    '以 CoinGecko 公布的 BTC 价格为准，若本季度内任何时刻的 BTC 价格高于此前历史最高价，则结果为 Yes，否则为 No。',
    'https://images.unsplash.com/photo-1621416894569-0f39d612179e?auto=format&fit=crop&w=800&q=80',
    '',
    'active',
    'binary',
    2,
    0,
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO public.prediction_outcomes (prediction_id, outcome_index, label)
SELECT new_event.id, v.outcome_index, v.label
FROM new_event
JOIN (VALUES (0, 'Yes'), (1, 'No')) AS v(outcome_index, label) ON TRUE;

WITH new_event AS (
  INSERT INTO public.predictions (
    title,
    description,
    category,
    deadline,
    min_stake,
    criteria,
    image_url,
    reference_url,
    status,
    type,
    outcome_count,
    followers_count,
    created_at,
    updated_at
  )
  VALUES (
    '以太坊在年底前是否完成下一个重大升级？',
    '关注以太坊官方路线图和核心开发者会议，判断在当前自然年结束前是否完成一次被官方标记为“主网升级”的重大版本更新。',
    'crypto',
    NOW() + INTERVAL '60 days',
    10,
    '以以太坊基金会和核心开发者公告为准，若在本年度内主网完成一次命名的升级（例如 Cancun、Dencun 等），则结果为 Yes，否则为 No。',
    'https://images.unsplash.com/photo-1621416894569-0f39d612179e?auto=format&fit=crop&w=800&q=80',
    '',
    'active',
    'binary',
    2,
    0,
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO public.prediction_outcomes (prediction_id, outcome_index, label)
SELECT new_event.id, v.outcome_index, v.label
FROM new_event
JOIN (VALUES (0, 'Yes'), (1, 'No')) AS v(outcome_index, label) ON TRUE;

WITH new_event AS (
  INSERT INTO public.predictions (
    title,
    description,
    category,
    deadline,
    min_stake,
    criteria,
    image_url,
    reference_url,
    status,
    type,
    outcome_count,
    followers_count,
    created_at,
    updated_at
  )
  VALUES (
    '本月主流公链 TVL 是否再创新高？',
    '统计当前月份内，以太坊、Solana、Base 等主流公链的 DeFi 总锁仓量（TVL）总和是否超过历史最高值。',
    'crypto',
    NOW() + INTERVAL '25 days',
    10,
    '以 DefiLlama 公布的 TVL 统计为准，将主流公链的 TVL 相加，若本自然月任意时刻的总和高于此前历史最高纪录，则结果为 Yes，否则为 No。',
    'https://images.unsplash.com/photo-1621416894569-0f39d612179e?auto=format&fit=crop&w=800&q=80',
    '',
    'active',
    'binary',
    2,
    0,
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO public.prediction_outcomes (prediction_id, outcome_index, label)
SELECT new_event.id, v.outcome_index, v.label
FROM new_event
JOIN (VALUES (0, 'Yes'), (1, 'No')) AS v(outcome_index, label) ON TRUE;

WITH new_event AS (
  INSERT INTO public.predictions (
    title,
    description,
    category,
    deadline,
    min_stake,
    criteria,
    image_url,
    reference_url,
    status,
    type,
    outcome_count,
    followers_count,
    created_at,
    updated_at
  )
  VALUES (
    '下一次美联储议息前，BTC 是否单日涨跌超 10%？',
    '观察下一次 FOMC 议息会议召开前 7 天内 BTC 的日内涨跌幅是否有超过 10% 的情况。',
    'crypto',
    NOW() + INTERVAL '40 days',
    10,
    '以 CoinGecko 公布的 BTC 价格为准，统计 FOMC 召开前 7 天内的每日涨跌幅（按 UTC 00:00 收盘价计算），若存在绝对涨跌幅 ≥ 10% 的交易日，则结果为 Yes，否则为 No。',
    'https://images.unsplash.com/photo-1621416894569-0f39d612179e?auto=format&fit=crop&w=800&q=80',
    '',
    'active',
    'binary',
    2,
    0,
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO public.prediction_outcomes (prediction_id, outcome_index, label)
SELECT new_event.id, v.outcome_index, v.label
FROM new_event
JOIN (VALUES (0, 'Yes'), (1, 'No')) AS v(outcome_index, label) ON TRUE;

-- 2) More (其他) events
WITH new_event AS (
  INSERT INTO public.predictions (
    title,
    description,
    category,
    deadline,
    min_stake,
    criteria,
    image_url,
    reference_url,
    status,
    type,
    outcome_count,
    followers_count,
    created_at,
    updated_at
  )
  VALUES (
    '今年是否会出现新的现象级 AI 应用？',
    '判断当前自然年内，是否有单一 AI 应用（不限领域）在全球范围内达到现象级用户增长和讨论热度。',
    'more',
    NOW() + INTERVAL '90 days',
    10,
    '参考各大应用商店下载榜、社交媒体热度和主流科技媒体报道，若出现被行业普遍认可为“现象级”的全新 AI 应用，则结果为 Yes，否则为 No。',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    '',
    'active',
    'binary',
    2,
    0,
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO public.prediction_outcomes (prediction_id, outcome_index, label)
SELECT new_event.id, v.outcome_index, v.label
FROM new_event
JOIN (VALUES (0, 'Yes'), (1, 'No')) AS v(outcome_index, label) ON TRUE;

WITH new_event AS (
  INSERT INTO public.predictions (
    title,
    description,
    category,
    deadline,
    min_stake,
    criteria,
    image_url,
    reference_url,
    status,
    type,
    outcome_count,
    followers_count,
    created_at,
    updated_at
  )
  VALUES (
    '某一线城市今年平均房价是否同比上涨？',
    '选择一线城市官方统计口径的住宅平均售价，比较本年度与上一年度的年均水平是否上涨。',
    'more',
    NOW() + INTERVAL '120 days',
    10,
    '以国家统计局或地方统计局公布的数据为准，若选定城市本年度全年住宅平均售价高于上一年度，则结果为 Yes，否则为 No。',
    'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=800&q=80',
    '',
    'active',
    'binary',
    2,
    0,
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO public.prediction_outcomes (prediction_id, outcome_index, label)
SELECT new_event.id, v.outcome_index, v.label
FROM new_event
JOIN (VALUES (0, 'Yes'), (1, 'No')) AS v(outcome_index, label) ON TRUE;

WITH new_event AS (
  INSERT INTO public.predictions (
    title,
    description,
    category,
    deadline,
    min_stake,
    criteria,
    image_url,
    reference_url,
    status,
    type,
    outcome_count,
    followers_count,
    created_at,
    updated_at
  )
  VALUES (
    '今年是否会出现全球票房前十的新电影 IP？',
    '判断当前自然年上映的新电影中，是否有全新 IP（非续集、非重启）进入全球票房前十名。',
    'more',
    NOW() + INTERVAL '180 days',
    10,
    '以 Box Office Mojo 等权威票房统计网站数据为准，若本年度内首次上映的全新 IP 电影进入当年全球票房前十，则结果为 Yes，否则为 No。',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
    '',
    'active',
    'binary',
    2,
    0,
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO public.prediction_outcomes (prediction_id, outcome_index, label)
SELECT new_event.id, v.outcome_index, v.label
FROM new_event
JOIN (VALUES (0, 'Yes'), (1, 'No')) AS v(outcome_index, label) ON TRUE;

WITH new_event AS (
  INSERT INTO public.predictions (
    title,
    description,
    category,
    deadline,
    min_stake,
    criteria,
    image_url,
    reference_url,
    status,
    type,
    outcome_count,
    followers_count,
    created_at,
    updated_at
  )
  VALUES (
    '今年是否会新增一个全球知名的社交平台？',
    '判断当前自然年是否会出现一个被全球广泛使用、月活用户突破千万级别的新社交产品。',
    'more',
    NOW() + INTERVAL '200 days',
    10,
    '以公开披露的用户规模、媒体报道和应用商店榜单为参考，若有新社交平台在当年内达到千万级月活并广泛被媒体报道，则结果为 Yes，否则为 No。',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    '',
    'active',
    'binary',
    2,
    0,
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO public.prediction_outcomes (prediction_id, outcome_index, label)
SELECT new_event.id, v.outcome_index, v.label
FROM new_event
JOIN (VALUES (0, 'Yes'), (1, 'No')) AS v(outcome_index, label) ON TRUE;
