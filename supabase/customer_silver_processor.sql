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
BEGIN
    IF cleaned = '' OR cleaned !~ '^[0-9]{8}$' THEN
        RETURN NULL;
    END IF;
    parsed := to_date(cleaned, 'YYYYMMDD');
    IF to_char(parsed, 'YYYYMMDD') <> cleaned THEN
        RETURN NULL;
    END IF;
    RETURN parsed;
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
        validation_status,
        quality_issues
    )
    WITH typed AS (
        SELECT
            bronze.id AS bronze_id,
            bronze.source_batch_id,
            upper(btrim(bronze."CUSTOMER NUMBER")) AS customer_number,
            nullif(upper(btrim(bronze."GENDER")), '') AS gender,
            public.try_customer_date(bronze."BIRTHDAY") AS birthday,
            public.try_customer_nonnegative_integer(bronze."AGE") AS age,
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
                PARTITION BY upper(btrim(bronze."CUSTOMER NUMBER"))
            ) AS customer_number_count
        FROM public.bronze_customer_database AS bronze
    ),
    assessed AS (
        SELECT
            typed.*,
            array_remove(ARRAY[
                CASE WHEN customer_number_count > 1
                    THEN 'duplicate_customer_number' END,
                CASE WHEN nullif(btrim(raw_birthday), '') IS NOT NULL
                          AND birthday IS NULL
                    THEN 'invalid_birthday' END,
                CASE WHEN nullif(btrim(raw_age), '') IS NOT NULL
                          AND age IS NULL
                    THEN 'invalid_age' END,
                CASE WHEN nullif(btrim(raw_expiry_date), '') IS NOT NULL
                          AND expiry_date IS NULL
                    THEN 'invalid_expiry_date' END,
                CASE WHEN nullif(btrim(raw_application_date), '') IS NOT NULL
                          AND application_date IS NULL
                    THEN 'invalid_application_date' END,
                CASE WHEN nullif(btrim(raw_member_since), '') IS NOT NULL
                          AND member_since IS NULL
                    THEN 'invalid_member_since' END,
                CASE WHEN nullif(btrim(raw_last_visit), '') IS NOT NULL
                          AND last_visit IS NULL
                    THEN 'invalid_last_visit' END,
                CASE WHEN nullif(btrim(raw_frequency), '') IS NOT NULL
                          AND frequency_of_visit IS NULL
                    THEN 'invalid_frequency_of_visit' END
            ], NULL) AS issues
        FROM typed
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
        CASE WHEN cardinality(issues) = 0 THEN 'clean' ELSE 'flagged' END,
        issues
    FROM assessed;

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
