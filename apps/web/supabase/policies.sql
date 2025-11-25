-- 事件关注表 RLS 策略
-- 允许所有用户只读，认证用户可插入/删除自身关注记录

alter table public.event_follows enable row level security;

create policy event_follows_select on public.event_follows
  for select
  using (true);

create policy event_follows_insert on public.event_follows
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy event_follows_delete on public.event_follows
  for delete
  to authenticated
  using (auth.uid() = user_id);

