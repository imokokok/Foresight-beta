-- 创建 prediction_outcomes 表（事件选项集）
create table if not exists public.prediction_outcomes (
  id uuid primary key default gen_random_uuid(),
  prediction_id int not null references public.predictions(id) on delete cascade,
  outcome_index int2 not null,
  label text not null,
  description text,
  color text,
  image_url text,
  created_at timestamptz not null default now(),
  unique (prediction_id, outcome_index)
);

create index if not exists prediction_outcomes_prediction_idx on public.prediction_outcomes (prediction_id);

comment on table public.prediction_outcomes is '预测事件的选项集合；支持二元与多元统一表示';
comment on column public.prediction_outcomes.prediction_id is '关联预测事件ID';
comment on column public.prediction_outcomes.outcome_index is '选项序号（从0开始，连续整数）';
comment on column public.prediction_outcomes.label is '选项标签（显示用）';
comment on column public.prediction_outcomes.description is '选项描述（可选）';
comment on column public.prediction_outcomes.color is '选项颜色（可选）';
comment on column public.prediction_outcomes.image_url is '选项图片URL（可选）';

