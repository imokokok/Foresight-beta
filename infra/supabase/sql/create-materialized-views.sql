-- 创建物化视图以优化性能
-- 运行方式：在 Supabase SQL Editor 中执行此文件

-- =====================================================
-- 1. 事件关注数物化视图
-- =====================================================
-- 用途：快速获取每个事件的关注人数，避免每次都扫描 event_follows 表

DROP MATERIALIZED VIEW IF EXISTS event_followers_count CASCADE;

CREATE MATERIALIZED VIEW event_followers_count AS
SELECT 
    event_id,
    COUNT(*) as followers_count
FROM event_follows
GROUP BY event_id;

-- 创建唯一索引以支持并发刷新
CREATE UNIQUE INDEX idx_event_followers_count_event_id 
ON event_followers_count(event_id);

-- 创建定期刷新任务（需要 pg_cron 扩展）
-- 每5分钟刷新一次
-- SELECT cron.schedule(
--     'refresh_event_followers_count',
--     '*/5 * * * *',
--     $$REFRESH MATERIALIZED VIEW CONCURRENTLY event_followers_count$$
-- );

-- 手动刷新命令：
-- REFRESH MATERIALIZED VIEW CONCURRENTLY event_followers_count;

COMMENT ON MATERIALIZED VIEW event_followers_count IS '事件关注数缓存，每5分钟自动刷新';


-- =====================================================
-- 2. 用户投资组合统计物化视图
-- =====================================================
-- 用途：快速获取用户的投资统计数据

DROP MATERIALIZED VIEW IF EXISTS user_portfolio_stats CASCADE;

CREATE MATERIALIZED VIEW user_portfolio_stats AS
SELECT 
    maker_address as user_address,
    COUNT(DISTINCT verifying_contract) as active_markets,
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_orders,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled_orders,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
FROM orders
GROUP BY maker_address;

CREATE UNIQUE INDEX idx_user_portfolio_stats_address 
ON user_portfolio_stats(user_address);

COMMENT ON MATERIALIZED VIEW user_portfolio_stats IS '用户投资组合统计缓存';


-- =====================================================
-- 3. 市场深度聚合视图（可选，数据量大时使用）
-- =====================================================
-- 用途：预聚合订单深度数据

DROP MATERIALIZED VIEW IF EXISTS market_depth_summary CASCADE;

CREATE MATERIALIZED VIEW market_depth_summary AS
SELECT 
    verifying_contract,
    chain_id,
    outcome_index,
    is_buy,
    price,
    SUM(remaining::numeric) as total_amount,
    COUNT(*) as order_count
FROM orders
WHERE status = 'open'
GROUP BY verifying_contract, chain_id, outcome_index, is_buy, price
ORDER BY verifying_contract, outcome_index, is_buy, price DESC;

CREATE INDEX idx_market_depth_summary_lookup 
ON market_depth_summary(verifying_contract, chain_id, outcome_index, is_buy);

COMMENT ON MATERIALIZED VIEW market_depth_summary IS '市场订单深度聚合缓存';


-- =====================================================
-- 4. 热门事件排行榜视图
-- =====================================================
-- 用途：快速获取热门事件列表

DROP MATERIALIZED VIEW IF EXISTS trending_predictions CASCADE;

CREATE MATERIALIZED VIEW trending_predictions AS
SELECT 
    p.id,
    p.title,
    p.description,
    p.category,
    p.image_url,
    p.deadline,
    p.status,
    p.created_at,
    COALESCE(ef.followers_count, 0) as followers_count,
    -- 计算热度分数（关注数 + 时间衰减）
    COALESCE(ef.followers_count, 0) * 
    EXP(-EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (7 * 24 * 3600)) as hot_score
FROM predictions p
LEFT JOIN event_followers_count ef ON p.id = ef.event_id
WHERE p.status = 'active'
ORDER BY hot_score DESC, p.created_at DESC
LIMIT 100;

CREATE INDEX idx_trending_predictions_hot_score 
ON trending_predictions(hot_score DESC);

COMMENT ON MATERIALIZED VIEW trending_predictions IS '热门事件排行榜，按热度分数排序';


-- =====================================================
-- 5. 创建自动刷新函数
-- =====================================================

-- 创建一个函数来刷新所有物化视图
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY event_followers_count;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_portfolio_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY market_depth_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY trending_predictions;
    
    RAISE NOTICE 'All materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_all_materialized_views() IS '刷新所有物化视图';


-- =====================================================
-- 6. 使用说明
-- =====================================================

/*
使用方法：

1. 初次创建后，手动刷新一次：
   SELECT refresh_all_materialized_views();

2. 设置定时任务（需要启用 pg_cron 扩展）：
   
   -- 每5分钟刷新一次
   SELECT cron.schedule(
       'refresh_materialized_views',
       '*/5 * * * *',
       $$SELECT refresh_all_materialized_views()$$
   );

3. 查看定时任务：
   SELECT * FROM cron.job;

4. 删除定时任务：
   SELECT cron.unschedule('refresh_materialized_views');

5. 查询物化视图（就像普通表一样）：
   
   -- 获取事件关注数
   SELECT * FROM event_followers_count WHERE event_id = 1;
   
   -- 获取用户统计
   SELECT * FROM user_portfolio_stats WHERE user_address = '0x...';
   
   -- 获取热门事件
   SELECT * FROM trending_predictions LIMIT 10;

性能提升：
- 原查询：需要扫描整个 event_follows 表并聚合（慢）
- 物化视图：直接读取预聚合结果（快，毫秒级）
*/

