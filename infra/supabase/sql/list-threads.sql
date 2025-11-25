SELECT id, event_id, title, hot_since, created_prediction_id, subject_name, action_verb, target_value, deadline
FROM public.forum_threads
ORDER BY id DESC
LIMIT 10;