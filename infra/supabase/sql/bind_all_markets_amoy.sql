-- Bind all existing predictions to the current test market
-- Market: 0xBec1Fd7e69346aCBa7C15d6E380FcCA993Ea6b02
-- Chain ID: 80002 (Amoy)
-- Collateral: 0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.predictions LOOP
    INSERT INTO public.markets_map (event_id, chain_id, market, collateral_token, tick_size, status)
    VALUES (
      r.id, 
      80002, 
      '0xBec1Fd7e69346aCBa7C15d6E380FcCA993Ea6b02', 
      '0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf', 
      1,
      'open'
    )
    ON CONFLICT (event_id, chain_id) 
    DO UPDATE SET 
      market = EXCLUDED.market,
      collateral_token = EXCLUDED.collateral_token,
      status = 'open';
  END LOOP;
END;
$$;
