-- 创建 markets_map 表（如不存在），并扩展 outcomes_count 字段
create table if not exists public.markets_map (
  event_id int not null,
  chain_id int8 not null,
  market text not null,
  collateral_token text,
  tick_size numeric(78,0),
  resolution_time timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (event_id, chain_id)
);

alter table if exists public.markets_map
  add column if not exists outcomes_count int2 not null default 2;

create index if not exists markets_map_event_idx on public.markets_map (event_id);
create index if not exists markets_map_market_idx on public.markets_map (market, chain_id);

comment on table public.markets_map is '预测事件到链上市场的映射（每链唯一）';
comment on column public.markets_map.outcomes_count is '该事件对应市场的选项数量（用于前端校验与兜底展示）';
