-- =====================================================
-- 创建 user_trading_stats 表来存储用户交易统计数据
-- =====================================================
-- 
-- 用于排行榜功能，缓存用户的交易统计数据
-- 避免每次请求都需要聚合大量交易数据
--
-- =====================================================

-- 1. 创建用户交易统计表
CREATE TABLE IF NOT EXISTS public.user_trading_stats (
  wallet_address TEXT PRIMARY KEY,
  trades_count INTEGER DEFAULT 0,
  total_volume NUMERIC DEFAULT 0,
  buy_volume NUMERIC DEFAULT 0,
  sell_volume NUMERIC DEFAULT 0,
  unique_markets INTEGER DEFAULT 0,
  first_trade_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,
  -- 按时间段统计
  daily_trades INTEGER DEFAULT 0,
  daily_volume NUMERIC DEFAULT 0,
  weekly_trades INTEGER DEFAULT 0,
  weekly_volume NUMERIC DEFAULT 0,
  monthly_trades INTEGER DEFAULT 0,
  monthly_volume NUMERIC DEFAULT 0,
  -- 缓存更新时间
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_trading_stats_volume 
ON public.user_trading_stats(total_volume DESC);

CREATE INDEX IF NOT EXISTS idx_user_trading_stats_trades 
ON public.user_trading_stats(trades_count DESC);

CREATE INDEX IF NOT EXISTS idx_user_trading_stats_weekly 
ON public.user_trading_stats(weekly_volume DESC);

COMMENT ON TABLE public.user_trading_stats IS '用户交易统计数据（用于排行榜）';

-- 2. 启用 RLS
ALTER TABLE public.user_trading_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_trading_stats_select_all" ON public.user_trading_stats FOR SELECT USING (true);

-- 3. 创建刷新函数
CREATE OR REPLACE FUNCTION public.refresh_user_trading_stats()
RETURNS void AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_daily_start TIMESTAMPTZ := v_now - INTERVAL '1 day';
  v_weekly_start TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_monthly_start TIMESTAMPTZ := v_now - INTERVAL '30 days';
BEGIN
  -- 清空并重新计算所有统计
  TRUNCATE public.user_trading_stats;
  
  -- 聚合所有交易者的统计数据
  WITH all_traders AS (
    -- 获取所有交易者地址（taker 和 maker）
    SELECT DISTINCT lower(taker_address) as wallet_address FROM public.trades
    UNION
    SELECT DISTINCT lower(maker_address) as wallet_address FROM public.trades
  ),
  trader_stats AS (
    SELECT 
      at.wallet_address,
      -- 总体统计
      COUNT(*) as trades_count,
      COALESCE(SUM(t.amount * t.price / 1000000), 0) as total_volume,
      COALESCE(SUM(CASE WHEN t.is_buy THEN t.amount * t.price / 1000000 ELSE 0 END), 0) as buy_volume,
      COALESCE(SUM(CASE WHEN NOT t.is_buy THEN t.amount * t.price / 1000000 ELSE 0 END), 0) as sell_volume,
      COUNT(DISTINCT t.market_address) as unique_markets,
      MIN(t.block_timestamp) as first_trade_at,
      MAX(t.block_timestamp) as last_trade_at,
      -- 每日统计
      COUNT(*) FILTER (WHERE t.block_timestamp >= v_daily_start) as daily_trades,
      COALESCE(SUM(t.amount * t.price / 1000000) FILTER (WHERE t.block_timestamp >= v_daily_start), 0) as daily_volume,
      -- 每周统计
      COUNT(*) FILTER (WHERE t.block_timestamp >= v_weekly_start) as weekly_trades,
      COALESCE(SUM(t.amount * t.price / 1000000) FILTER (WHERE t.block_timestamp >= v_weekly_start), 0) as weekly_volume,
      -- 每月统计
      COUNT(*) FILTER (WHERE t.block_timestamp >= v_monthly_start) as monthly_trades,
      COALESCE(SUM(t.amount * t.price / 1000000) FILTER (WHERE t.block_timestamp >= v_monthly_start), 0) as monthly_volume
    FROM all_traders at
    LEFT JOIN public.trades t ON (
      lower(t.taker_address) = at.wallet_address OR 
      lower(t.maker_address) = at.wallet_address
    )
    GROUP BY at.wallet_address
  )
  INSERT INTO public.user_trading_stats (
    wallet_address,
    trades_count,
    total_volume,
    buy_volume,
    sell_volume,
    unique_markets,
    first_trade_at,
    last_trade_at,
    daily_trades,
    daily_volume,
    weekly_trades,
    weekly_volume,
    monthly_trades,
    monthly_volume,
    last_updated_at
  )
  SELECT 
    wallet_address,
    trades_count,
    total_volume,
    buy_volume,
    sell_volume,
    unique_markets,
    first_trade_at,
    last_trade_at,
    daily_trades,
    daily_volume,
    weekly_trades,
    weekly_volume,
    monthly_trades,
    monthly_volume,
    v_now
  FROM trader_stats
  WHERE trades_count > 0;

  RAISE NOTICE 'user_trading_stats refreshed successfully at %', v_now;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.refresh_user_trading_stats() IS '刷新用户交易统计数据（用于排行榜）';

-- 4. 创建增量更新触发器函数
CREATE OR REPLACE FUNCTION public.update_user_trading_stats_on_trade()
RETURNS TRIGGER AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_trade_value NUMERIC;
  v_daily_start TIMESTAMPTZ := v_now - INTERVAL '1 day';
  v_weekly_start TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_monthly_start TIMESTAMPTZ := v_now - INTERVAL '30 days';
  v_is_daily BOOLEAN;
  v_is_weekly BOOLEAN;
  v_is_monthly BOOLEAN;
BEGIN
  v_trade_value := NEW.amount * NEW.price / 1000000;
  v_is_daily := NEW.block_timestamp >= v_daily_start;
  v_is_weekly := NEW.block_timestamp >= v_weekly_start;
  v_is_monthly := NEW.block_timestamp >= v_monthly_start;

  -- 更新 taker 统计
  INSERT INTO public.user_trading_stats (
    wallet_address, trades_count, total_volume, buy_volume, sell_volume, 
    unique_markets, first_trade_at, last_trade_at,
    daily_trades, daily_volume, weekly_trades, weekly_volume, monthly_trades, monthly_volume,
    last_updated_at
  ) VALUES (
    lower(NEW.taker_address), 1, v_trade_value,
    CASE WHEN NEW.is_buy THEN v_trade_value ELSE 0 END,
    CASE WHEN NOT NEW.is_buy THEN v_trade_value ELSE 0 END,
    1, NEW.block_timestamp, NEW.block_timestamp,
    CASE WHEN v_is_daily THEN 1 ELSE 0 END,
    CASE WHEN v_is_daily THEN v_trade_value ELSE 0 END,
    CASE WHEN v_is_weekly THEN 1 ELSE 0 END,
    CASE WHEN v_is_weekly THEN v_trade_value ELSE 0 END,
    CASE WHEN v_is_monthly THEN 1 ELSE 0 END,
    CASE WHEN v_is_monthly THEN v_trade_value ELSE 0 END,
    v_now
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    trades_count = user_trading_stats.trades_count + 1,
    total_volume = user_trading_stats.total_volume + v_trade_value,
    buy_volume = user_trading_stats.buy_volume + CASE WHEN NEW.is_buy THEN v_trade_value ELSE 0 END,
    sell_volume = user_trading_stats.sell_volume + CASE WHEN NOT NEW.is_buy THEN v_trade_value ELSE 0 END,
    last_trade_at = GREATEST(user_trading_stats.last_trade_at, NEW.block_timestamp),
    daily_trades = user_trading_stats.daily_trades + CASE WHEN v_is_daily THEN 1 ELSE 0 END,
    daily_volume = user_trading_stats.daily_volume + CASE WHEN v_is_daily THEN v_trade_value ELSE 0 END,
    weekly_trades = user_trading_stats.weekly_trades + CASE WHEN v_is_weekly THEN 1 ELSE 0 END,
    weekly_volume = user_trading_stats.weekly_volume + CASE WHEN v_is_weekly THEN v_trade_value ELSE 0 END,
    monthly_trades = user_trading_stats.monthly_trades + CASE WHEN v_is_monthly THEN 1 ELSE 0 END,
    monthly_volume = user_trading_stats.monthly_volume + CASE WHEN v_is_monthly THEN v_trade_value ELSE 0 END,
    last_updated_at = v_now;

  -- 更新 maker 统计
  INSERT INTO public.user_trading_stats (
    wallet_address, trades_count, total_volume, buy_volume, sell_volume, 
    unique_markets, first_trade_at, last_trade_at,
    daily_trades, daily_volume, weekly_trades, weekly_volume, monthly_trades, monthly_volume,
    last_updated_at
  ) VALUES (
    lower(NEW.maker_address), 1, v_trade_value,
    CASE WHEN NOT NEW.is_buy THEN v_trade_value ELSE 0 END,
    CASE WHEN NEW.is_buy THEN v_trade_value ELSE 0 END,
    1, NEW.block_timestamp, NEW.block_timestamp,
    CASE WHEN v_is_daily THEN 1 ELSE 0 END,
    CASE WHEN v_is_daily THEN v_trade_value ELSE 0 END,
    CASE WHEN v_is_weekly THEN 1 ELSE 0 END,
    CASE WHEN v_is_weekly THEN v_trade_value ELSE 0 END,
    CASE WHEN v_is_monthly THEN 1 ELSE 0 END,
    CASE WHEN v_is_monthly THEN v_trade_value ELSE 0 END,
    v_now
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    trades_count = user_trading_stats.trades_count + 1,
    total_volume = user_trading_stats.total_volume + v_trade_value,
    buy_volume = user_trading_stats.buy_volume + CASE WHEN NOT NEW.is_buy THEN v_trade_value ELSE 0 END,
    sell_volume = user_trading_stats.sell_volume + CASE WHEN NEW.is_buy THEN v_trade_value ELSE 0 END,
    last_trade_at = GREATEST(user_trading_stats.last_trade_at, NEW.block_timestamp),
    daily_trades = user_trading_stats.daily_trades + CASE WHEN v_is_daily THEN 1 ELSE 0 END,
    daily_volume = user_trading_stats.daily_volume + CASE WHEN v_is_daily THEN v_trade_value ELSE 0 END,
    weekly_trades = user_trading_stats.weekly_trades + CASE WHEN v_is_weekly THEN 1 ELSE 0 END,
    weekly_volume = user_trading_stats.weekly_volume + CASE WHEN v_is_weekly THEN v_trade_value ELSE 0 END,
    monthly_trades = user_trading_stats.monthly_trades + CASE WHEN v_is_monthly THEN 1 ELSE 0 END,
    monthly_volume = user_trading_stats.monthly_volume + CASE WHEN v_is_monthly THEN v_trade_value ELSE 0 END,
    last_updated_at = v_now;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS on_trade_update_user_stats ON public.trades;
CREATE TRIGGER on_trade_update_user_stats
AFTER INSERT ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.update_user_trading_stats_on_trade();

-- 6. 初始化：立即刷新一次统计数据
SELECT public.refresh_user_trading_stats();

-- =====================================================
-- 使用说明
-- =====================================================
-- 1. 首次运行此脚本后，会自动从 trades 表聚合历史数据
-- 2. 新的交易会通过触发器自动更新统计
-- 3. 如需手动刷新（每日推荐执行一次以重置时间段统计）：
--    SELECT public.refresh_user_trading_stats();
-- 4. 查看统计数据：
--    SELECT * FROM public.user_trading_stats ORDER BY total_volume DESC LIMIT 50;

