-- =============================================
-- CUSTOMER BRONZE -> SILVER PROCESSOR
-- =============================================
-- Run this file once in the Supabase SQL Editor to install the processor.
-- Installing it does not process any rows. Processing starts only when
-- public.refresh_customer_silver() is called.

CREATE OR REPLACE FUNCTION public.try_customer_date(raw_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    cleaned text := btrim(raw_value);
    parsed date;
    parts text[];
BEGIN
    IF cleaned = '' OR upper(cleaned) IN ('-', 'NAN', '<NA>') THEN
        RETURN NULL;
    END IF;

    IF cleaned ~ '^[0-9]{8}$' THEN
        parsed := to_date(cleaned, 'YYYYMMDD');
        IF to_char(parsed, 'YYYYMMDD') = cleaned THEN
            RETURN parsed;
        END IF;
        RETURN NULL;
    ELSIF cleaned ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        parsed := cleaned::date;
        RETURN parsed;
    ELSIF cleaned ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} ' THEN
        parsed := substring(cleaned FROM 1 FOR 10)::date;
        RETURN parsed;
    ELSIF cleaned ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN
        parts := string_to_array(cleaned, '/');
        BEGIN
            RETURN make_date(parts[3]::integer, parts[1]::integer, parts[2]::integer);
        EXCEPTION WHEN OTHERS THEN
            RETURN make_date(parts[3]::integer, parts[2]::integer, parts[1]::integer);
        END;
    END IF;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.try_customer_integer(raw_value text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    cleaned text := btrim(raw_value);
BEGIN
    IF cleaned = '' OR upper(cleaned) IN ('-', 'NAN', '<NA>')
       OR cleaned !~ '^-?[0-9]+$' THEN
        RETURN NULL;
    END IF;
    RETURN cleaned::integer;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.try_customer_nonnegative_integer(raw_value text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    cleaned text := btrim(raw_value);
    parsed bigint;
BEGIN
    IF cleaned = '' OR cleaned !~ '^[0-9]+$' THEN
        RETURN NULL;
    END IF;
    parsed := cleaned::bigint;
    IF parsed > 2147483647 THEN
        RETURN NULL;
    END IF;
    RETURN parsed::integer;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_customer_silver()
RETURNS TABLE (
    processed_row_count bigint,
    clean_row_count bigint,
    flagged_row_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5min'
AS $$
BEGIN
    -- A refresh is atomic: readers see either the previous complete result or
    -- the new complete result, never a partially transformed Silver layer.
    TRUNCATE TABLE public.silver_customer_database RESTART IDENTITY;

    INSERT INTO public.silver_customer_database (
        bronze_id,
        source_batch_id,
        "CUSTOMER NUMBER",
        "GENDER",
        "BIRTHDAY",
        "AGE",
        "CITY",
        "PROVINCE",
        "EXPIRY DATE",
        "MEMBER LOCATION",
        "APPLICATION DATE",
        "MEMBER SINCE",
        "LAST VISIT",
        "FREQUENCY OF VISIT",
        "LAST VISITED STORE",
        anomaly_class,
        validation_status,
        quality_issues
    )
    WITH typed AS MATERIALIZED (
        SELECT
            bronze.id AS bronze_id,
            bronze.source_batch_id,
            upper(btrim(bronze."CUSTOMER NUMBER")) AS customer_number,
            nullif(upper(btrim(bronze."GENDER")), '') AS gender,
            public.try_customer_date(bronze."BIRTHDAY") AS birthday,
            public.try_customer_integer(bronze."AGE") AS age,
            nullif(btrim(bronze."CITY"), '') AS city,
            nullif(btrim(bronze."PROVINCE"), '') AS province,
            public.try_customer_date(bronze."EXPIRY DATE") AS expiry_date,
            nullif(btrim(bronze."MEMBER LOCATION"), '') AS member_location,
            public.try_customer_date(bronze."APPLICATION DATE") AS application_date,
            public.try_customer_date(bronze."MEMBER SINCE") AS member_since,
            public.try_customer_date(bronze."LAST VISIT") AS last_visit,
            public.try_customer_nonnegative_integer(
                bronze."FREQUENCY OF VISIT"
            ) AS frequency_of_visit,
            nullif(btrim(bronze."LAST VISITED STORE"), '') AS last_visited_store,
            bronze."BIRTHDAY" AS raw_birthday,
            bronze."AGE" AS raw_age,
            bronze."EXPIRY DATE" AS raw_expiry_date,
            bronze."APPLICATION DATE" AS raw_application_date,
            bronze."MEMBER SINCE" AS raw_member_since,
            bronze."LAST VISIT" AS raw_last_visit,
            bronze."FREQUENCY OF VISIT" AS raw_frequency,
            count(*) OVER (
                PARTITION BY bronze.source_batch_id,
                             upper(btrim(bronze."CUSTOMER NUMBER"))
            ) AS customer_number_count
        FROM public.bronze_customer_database AS bronze
    ),
    assessed AS (
        SELECT
            typed.*,
            (
                customer_number IS NULL
                OR customer_number IN ('-', 'NAN', '<NA>')
            ) AS is_missing_customer_number,
            (
                customer_number IS NOT NULL
                AND customer_number NOT IN ('-', 'NAN', '<NA>')
                AND customer_number_count > 1
            ) AS is_duplicate_customer_number,
            (
                province IS NULL OR upper(province) IN ('-', 'NAN', '<NA>')
            ) AS is_without_province,
            (
                nullif(btrim(raw_birthday), '') IS NOT NULL
                AND upper(btrim(raw_birthday)) NOT IN ('-', 'NAN', '<NA>')
                AND birthday IS NULL
            ) AS is_birthday_invalid,
            (birthday > current_date) AS is_birthday_in_future,
            (
                birthday IS NOT NULL
                AND extract(year FROM current_date) - extract(year FROM birthday) > 120
            ) AS is_birthday_age_over_120,
            (
                nullif(btrim(raw_age), '') IS NOT NULL
                AND upper(btrim(raw_age)) NOT IN ('-', 'NAN', '<NA>')
                AND age IS NULL
            ) AS is_age_invalid,
            (
                birthday IS NOT NULL AND age IS NOT NULL
                AND abs(
                    extract(year FROM current_date) - extract(year FROM birthday) - age
                ) > 2
            ) AS is_birthday_age_mismatch
        FROM typed
    ),
    classified AS (
        SELECT
            assessed.*,
            array_remove(ARRAY[
                CASE WHEN is_missing_customer_number
                    THEN 'missing_customer_number' END,
                CASE WHEN is_duplicate_customer_number
                    THEN 'duplicate_customer_number' END,
                CASE WHEN is_without_province
                    THEN 'without_province' END,
                CASE WHEN is_birthday_invalid
                    THEN 'birthday_invalid' END,
                CASE WHEN is_birthday_in_future
                    THEN 'birthday_in_future' END,
                CASE WHEN is_birthday_age_over_120
                    THEN 'birthday_age_over_120' END,
                CASE WHEN is_age_invalid
                    THEN 'age_invalid' END,
                CASE WHEN is_birthday_age_mismatch
                    THEN 'birthday_age_mismatch' END
            ], NULL) AS issues,
            CASE
                WHEN is_missing_customer_number
                  OR is_duplicate_customer_number
                  OR is_birthday_invalid
                  OR is_birthday_in_future
                  OR is_birthday_age_over_120
                  OR is_age_invalid
                  OR is_birthday_age_mismatch THEN '1B'
                WHEN is_without_province THEN '1A'
                ELSE '0'
            END AS calculated_anomaly_class
        FROM assessed
    )
    SELECT
        bronze_id,
        source_batch_id,
        customer_number,
        gender,
        birthday,
        age,
        city,
        province,
        expiry_date,
        member_location,
        application_date,
        member_since,
        last_visit,
        frequency_of_visit,
        last_visited_store,
        calculated_anomaly_class,
        CASE WHEN calculated_anomaly_class = '0' THEN 'clean' ELSE 'flagged' END,
        issues
    FROM classified;

    RETURN QUERY
    SELECT
        count(*)::bigint,
        count(*) FILTER (WHERE validation_status = 'clean')::bigint,
        count(*) FILTER (WHERE validation_status = 'flagged')::bigint
    FROM public.silver_customer_database;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_customer_silver() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_customer_silver() FROM anon;
REVOKE ALL ON FUNCTION public.refresh_customer_silver() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_customer_silver() TO service_role;

NOTIFY pgrst, 'reload schema';
