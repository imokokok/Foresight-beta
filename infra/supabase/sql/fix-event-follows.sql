-- 修复 event_follows 表结构：将 user_id 改为 TEXT，并确保唯一索引存在
-- 幂等执行，可安全重复运行

-- 删除可能存在的历史外键约束（不同环境可能不存在）
ALTER TABLE IF EXISTS public.event_follows DROP CONSTRAINT IF EXISTS event_follows_user_id_fkey;

-- 将 user_id 列类型改为 TEXT（保留现有数据）
ALTER TABLE IF EXISTS public.event_follows ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- 清理旧索引（如存在）
DROP INDEX IF EXISTS public.event_follows_user_id_event_id_idx;

-- 创建唯一索引，确保 (user_id, event_id) 唯一
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);