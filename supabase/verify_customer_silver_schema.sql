-- Both rows must return exists = true.
SELECT
    expected.table_name,
    to_regclass(format('public.%I', expected.table_name)) IS NOT NULL AS exists
FROM (
    VALUES
        ('silver_customer_database'),
        ('customer_silver_runs')
) AS expected(table_name);

-- Confirms Silver column names, types, and nullability.
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'silver_customer_database'
ORDER BY ordinal_position;

-- Must return zero until Bronze-to-Silver processing is deliberately started.
SELECT count(*) AS silver_rows
FROM public.silver_customer_database;

-- Confirms that RLS is enabled for both Silver tables.
SELECT
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM pg_class
WHERE oid IN (
    'public.silver_customer_database'::regclass,
    'public.customer_silver_runs'::regclass
)
ORDER BY relname;
