-- Both rows must return exists = true.
SELECT
    expected.table_name,
    to_regclass(format('public.%I', expected.table_name)) IS NOT NULL AS exists
FROM (
    VALUES
        ('customer_batches'),
        ('bronze_customer_database')
) AS expected(table_name);

-- Confirms the Bronze table column names, types, and nullability.
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bronze_customer_database'
ORDER BY ordinal_position;

-- Confirms that RLS is enabled for both tables.
SELECT
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM pg_class
WHERE oid IN (
    'public.customer_batches'::regclass,
    'public.bronze_customer_database'::regclass
)
ORDER BY relname;
