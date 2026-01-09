-- Cleanup test buy orders on Amoy CLOB market used for testing
-- Market: 0x8b2aE97451d5773319b9d3480A71b010a544A10b
-- Chain ID: 80002 (Amoy)

UPDATE public.orders
SET status = 'canceled',
    remaining = '0'
WHERE verifying_contract = '0x8b2ae97451d5773319b9d3480a71b010a544a10b'
  AND chain_id = 80002
  AND is_buy = TRUE
  AND status IN ('open', 'filled_partial');
