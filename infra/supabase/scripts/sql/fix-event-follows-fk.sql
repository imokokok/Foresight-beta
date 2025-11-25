-- 修复 event_follows.event_id 外键，确保指向 public.predictions(id)
-- 并开启 ON DELETE CASCADE，避免删除预测后留下孤儿关注记录

BEGIN;

-- 1) 删除可能存在的错误外键约束（名称可能不同，使用 IF EXISTS）
ALTER TABLE public.event_follows
  DROP CONSTRAINT IF EXISTS event_follows_event_id_fkey;

-- 2) 重新添加正确的外键约束，指向 public.predictions(id)
ALTER TABLE public.event_follows
  ADD CONSTRAINT event_follows_event_id_fkey
  FOREIGN KEY (event_id)
  REFERENCES public.predictions(id)
  ON DELETE CASCADE;

COMMIT;

-- 可选：对 user_id 类型和唯一约束进行修复（若之前错误配置为整数或有错误外键）
-- ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
-- ALTER TABLE public.event_follows DROP CONSTRAINT IF EXISTS event_follows_user_id_fkey;
-- CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);