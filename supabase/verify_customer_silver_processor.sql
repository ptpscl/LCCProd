-- Confirms that the processor and safe conversion helpers exist.
SELECT
    routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
      'try_customer_date',
      'try_customer_nonnegative_integer',
      'refresh_customer_silver'
  )
ORDER BY routine_name;

-- Conversion smoke tests. Expected outputs:
-- valid_date = 2001-01-01, invalid_date = NULL,
-- valid_integer = 12, invalid_integer = NULL.
SELECT
    public.try_customer_date('20010101') AS valid_date,
    public.try_customer_date('10112') AS invalid_date,
    public.try_customer_nonnegative_integer('12') AS valid_integer,
    public.try_customer_nonnegative_integer('-1') AS invalid_integer;

-- Do not run the refresh here. It will be started by the backend/UI in the
-- next phase so its progress and result are recorded in customer_silver_runs.
