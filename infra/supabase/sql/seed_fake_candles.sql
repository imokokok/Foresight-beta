-- 插入模拟 K 线数据 (最近 24 小时)
-- 用于在没有真实交易数据时测试 K 线图显示
DO $$
DECLARE
  m RECORD;
  i INT;
  base_price NUMERIC := 0.5;
  current_price NUMERIC;
  time_cursor TIMESTAMPTZ;
BEGIN
  -- 为前 5 个市场生成数据
  FOR m IN SELECT market, chain_id FROM public.markets_map LIMIT 5 LOOP
    current_price := base_price;
    -- 从 24 小时前开始
    time_cursor := date_trunc('hour', NOW()) - INTERVAL '24 hours';
    
    FOR i IN 1..96 LOOP -- 每 15 分钟一根，共 96 根 (24小时)
      -- 随机价格波动 (+- 5%)
      current_price := current_price * (1 + (random() * 0.1 - 0.05));
      -- 限制价格在 0.01 - 0.99 之间
      IF current_price > 0.99 THEN current_price := 0.99; END IF;
      IF current_price < 0.01 THEN current_price := 0.01; END IF;

      -- 插入 Yes 选项 (outcome 0)
      INSERT INTO public.candles (
        network_id, market_address, outcome_index, resolution, 
        open, high, low, close, volume, time
      ) VALUES (
        m.chain_id, lower(m.market), 0, '15m',
        current_price, 
        current_price * (1 + random() * 0.02), -- high
        current_price * (1 - random() * 0.02), -- low
        current_price * (1 + (random() * 0.02 - 0.01)), -- close (slightly different from open/high/low logic for randomness)
        floor(1000 * random()), -- volume
        time_cursor
      ) ON CONFLICT DO NOTHING;
      
      -- 插入 No 选项 (outcome 1) - 价格互补
      INSERT INTO public.candles (
        network_id, market_address, outcome_index, resolution, 
        open, high, low, close, volume, time
      ) VALUES (
        m.chain_id, lower(m.market), 1, '15m',
        1-current_price, 
        (1-current_price) * 1.02, 
        (1-current_price) * 0.98, 
        1-current_price, 
        floor(1000 * random()), 
        time_cursor
      ) ON CONFLICT DO NOTHING;

      time_cursor := time_cursor + INTERVAL '15 minutes';
    END LOOP;
  END LOOP;
END $$;
