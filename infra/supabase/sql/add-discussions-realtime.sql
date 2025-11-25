DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'discussions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.discussions;
  END IF;
END $$;