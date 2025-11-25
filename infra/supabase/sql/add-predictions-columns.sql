-- 扩展 predictions 表以支持多元化事件
alter table if exists public.predictions
  add column if not exists type text not null default 'binary' check (type in ('binary','multi')),
  add column if not exists outcome_count int2 not null default 2;

comment on column public.predictions.type is '事件类型：binary（二元）或 multi（多元）';
comment on column public.predictions.outcome_count is '事件的选项数量（用于前端与映射兜底）';

