select 'predictions.type/outcome_count' as section;
select count(*) as total, sum(case when type='multi' then 1 else 0 end) as multi_count from public.predictions;

select 'prediction_outcomes per prediction' as section;
select p.id, p.title, p.type, p.outcome_count, count(o.id) as outcomes
from public.predictions p
left join public.prediction_outcomes o on o.prediction_id = p.id
group by p.id, p.title, p.type, p.outcome_count
order by p.id asc
limit 20;

