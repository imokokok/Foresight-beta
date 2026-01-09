-- Upgrade trades table to support multiple fills per transaction (tx_hash + log_index)
-- and provide an idempotent RPC to ingest a trade event and update the maker order remaining.

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS log_index INTEGER,
  ADD COLUMN IF NOT EXISTS fee TEXT,
  ADD COLUMN IF NOT EXISTS salt TEXT;

-- Backfill / enforce log_index not null
UPDATE public.trades SET log_index = 0 WHERE log_index IS NULL;
ALTER TABLE public.trades ALTER COLUMN log_index SET NOT NULL;

-- Drop legacy uniqueness on tx_hash (it prevents multiple events in one tx)
ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_tx_hash_key;
DROP INDEX IF EXISTS public.trades_tx_hash_key;

-- New uniqueness: one row per event log in a tx
CREATE UNIQUE INDEX IF NOT EXISTS trades_tx_hash_log_index_unique
  ON public.trades (tx_hash, log_index);

-- Keep an index for quick tx lookup
CREATE INDEX IF NOT EXISTS trades_tx_hash_idx ON public.trades (tx_hash);

-- Idempotent ingestion: insert trade if missing; if inserted, decrement maker order remaining and update status.
CREATE OR REPLACE FUNCTION public.ingest_trade_event(
  p_network_id INTEGER,
  p_market_address TEXT,
  p_outcome_index INTEGER,
  p_price TEXT,
  p_amount TEXT,
  p_taker_address TEXT,
  p_maker_address TEXT,
  p_is_buy BOOLEAN,
  p_tx_hash TEXT,
  p_log_index INTEGER,
  p_block_number BIGINT,
  p_block_timestamp TIMESTAMPTZ,
  p_fee TEXT,
  p_salt TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted BOOLEAN := FALSE;
  v_row_count INTEGER;
BEGIN
  INSERT INTO public.trades (
    network_id,
    market_address,
    outcome_index,
    price,
    amount,
    taker_address,
    maker_address,
    is_buy,
    tx_hash,
    log_index,
    block_number,
    block_timestamp,
    fee,
    salt
  ) VALUES (
    p_network_id,
    lower(p_market_address),
    p_outcome_index,
    p_price::numeric,
    p_amount::numeric,
    lower(p_taker_address),
    lower(p_maker_address),
    p_is_buy,
    lower(p_tx_hash),
    p_log_index,
    p_block_number,
    p_block_timestamp,
    p_fee,
    p_salt
  )
  ON CONFLICT (tx_hash, log_index) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  inserted := v_row_count > 0;

  RETURN jsonb_build_object('inserted', inserted);
END;
$$;
