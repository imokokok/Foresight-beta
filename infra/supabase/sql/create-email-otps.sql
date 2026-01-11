
CREATE TABLE IF NOT EXISTS public.email_otps (
  wallet_address TEXT NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_window_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_in_window INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  lock_until TIMESTAMPTZ,
  created_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wallet_address, email)
);

ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
