-- 检查 event_follows 表的索引与列类型
\echo Checking indexes and column types for event_follows

-- 列类型
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'event_follows' AND column_name IN ('user_id', 'event_id');

-- 索引信息
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'event_follows';