-- Both rows must report exists = true.
SELECT
    table_name,
    to_regclass(format('public.%I', table_name)) IS NOT NULL AS exists
FROM (
    VALUES
        ('customer_batches'),
        ('bronze_customer_database')
) AS expected_tables(table_name);

-- Confirm that all 13 source columns exist in Bronze.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bronze_customer_database'
ORDER BY ordinal_position;
