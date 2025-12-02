-- RPC to decrement order remaining amount safely
CREATE OR REPLACE FUNCTION decrement_order_remaining(
  p_chain_id INTEGER,
  p_contract TEXT,
  p_maker TEXT,
  p_salt TEXT,
  p_amount TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amount NUMERIC;
  v_remaining NUMERIC;
BEGIN
  v_amount := p_amount::NUMERIC;
  
  -- Get current remaining
  SELECT remaining::NUMERIC INTO v_remaining
  FROM orders
  WHERE chain_id = p_chain_id
    AND verifying_contract = p_contract
    AND maker_address = p_maker
    AND maker_salt = p_salt;

  IF v_remaining IS NOT NULL THEN
    -- Update
    UPDATE orders
    SET remaining = GREATEST(0, v_remaining - v_amount)::TEXT,
        status = CASE WHEN (v_remaining - v_amount) <= 0 THEN 'filled' ELSE status END,
        updated_at = NOW()
    WHERE chain_id = p_chain_id
      AND verifying_contract = p_contract
      AND maker_address = p_maker
      AND maker_salt = p_salt;
  END IF;
END;
$$;
