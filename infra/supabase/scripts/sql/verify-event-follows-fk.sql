-- 验证 event_follows 外键是否正确指向 public.predictions(id)
-- 以及是否启用了 ON DELETE CASCADE

-- 注意：以下查询依赖 pg_catalog，需使用数据库直连运行

-- 查看 event_follows 表的所有约束（特别关注 event_id 外键）
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_def,
  cl.relname AS table_name,
  ns.nspname AS schema_name,
  confcl.relname AS referenced_table,
  confns.nspname AS referenced_schema
FROM pg_constraint con
JOIN pg_class cl ON cl.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cl.relnamespace
LEFT JOIN pg_class confcl ON confcl.oid = con.confrelid
LEFT JOIN pg_namespace confns ON confns.oid = confcl.relnamespace
WHERE ns.nspname = 'public'
  AND cl.relname = 'event_follows';

-- 验证 predictions 表是否存在指定 id（示例：52）
SELECT id FROM public.predictions WHERE id = 52;

-- 注意：\d+ 是 psql 元命令，Node 直连不可用，已移除