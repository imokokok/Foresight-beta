-- 为缺少 outcomes 的二元事件回填 Yes/No
insert into public.prediction_outcomes (prediction_id, outcome_index, label)
select p.id, 0 as outcome_index, 'Yes' as label
from public.predictions p
left join public.prediction_outcomes o on o.prediction_id = p.id and o.outcome_index = 0
where (p.type is null or p.type = 'binary') and o.id is null;

insert into public.prediction_outcomes (prediction_id, outcome_index, label)
select p.id, 1 as outcome_index, 'No' as label
from public.predictions p
left join public.prediction_outcomes o on o.prediction_id = p.id and o.outcome_index = 1
where (p.type is null or p.type = 'binary') and o.id is null;

update public.predictions p
set type = 'binary', outcome_count = 2
where (p.type is null or p.type not in ('binary','multi'));

