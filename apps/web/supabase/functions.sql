-- 安全切换关注状态（若存在则删除，否则插入）
-- 需要 service role 执行或调用带有 SECURITY DEFINER 的函数

create or replace function public.safe_toggle_follow(p_event_id int, p_user_id uuid)
returns void as $$
begin
  if exists (select 1 from public.event_follows where event_id = p_event_id and user_id = p_user_id) then
    delete from public.event_follows where event_id = p_event_id and user_id = p_user_id;
  else
    insert into public.event_follows(event_id, user_id) values (p_event_id, p_user_id);
  end if;
end;
$$ language plpgsql security definer;

