-- 函数：当 trades 插入时更新 candles
CREATE OR REPLACE FUNCTION public.update_candles_from_trade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- 定义需要支持的时间周期（秒）
  resolutions text[] := ARRAY['1m', '5m', '15m', '1h', '4h', '1d'];
  intervals int[] := ARRAY[60, 300, 900, 3600, 14400, 86400];
  
  v_res text;
  v_int int;
  v_time timestamptz;
  v_price numeric;
  v_amount numeric;
  i int;
BEGIN
  v_price := NEW.price::numeric;
  v_amount := NEW.amount::numeric;

  -- 遍历每个周期
  FOR i IN 1 .. array_length(resolutions, 1) LOOP
    v_res := resolutions[i];
    v_int := intervals[i];
    
    -- 计算该周期的起始时间 (向下取整)
    v_time := to_timestamp(floor(extract(epoch from NEW.block_timestamp) / v_int) * v_int);

    -- 尝试插入新行，如果冲突则更新
    INSERT INTO public.candles (
      network_id,
      market_address,
      outcome_index,
      resolution,
      open,
      high,
      low,
      close,
      volume,
      time
    ) VALUES (
      NEW.network_id,
      NEW.market_address,
      NEW.outcome_index,
      v_res,
      v_price, -- open (如果是新K线，open=price)
      v_price, -- high
      v_price, -- low
      v_price, -- close
      v_amount, -- volume
      v_time
    )
    ON CONFLICT (network_id, market_address, outcome_index, resolution, time)
    DO UPDATE SET
      high = GREATEST(public.candles.high, EXCLUDED.high),
      low = LEAST(public.candles.low, EXCLUDED.low),
      close = EXCLUDED.close, -- close 总是最新的价格
      volume = public.candles.volume + EXCLUDED.volume;
      
    -- 注意：这里没有更新 open，因为 open 应该是该时间段的第一笔交易价格。
    -- ON CONFLICT DO UPDATE 不会改变已存在的行的 open 值，这符合逻辑。
  END LOOP;

  RETURN NEW;
END;
$$;

-- 触发器
DROP TRIGGER IF EXISTS on_trade_inserted_update_candles ON public.trades;
CREATE TRIGGER on_trade_inserted_update_candles
AFTER INSERT ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.update_candles_from_trade();
