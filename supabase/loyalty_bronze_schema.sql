-- ==========================================
-- DATASET: LOYALTY SALES (BRONZE LAYER)
-- OWNER: LOYALTY SALES TEAM
-- ==========================================

-- This table holds the raw, schema-validated data from the Bronze layer.
-- Anomaly detection and cleaning will happen in the Silver layer.

CREATE TABLE IF NOT EXISTS bronze_loyalty_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Expected Schema Columns
    "DATE" DATE,
    "TRANSACTION NUMBER" VARCHAR(255),
    "REGISTER NUMBER" VARCHAR(255),
    "STORE CODE" VARCHAR(255),
    "STORE CATEGORIZATION" VARCHAR(255),
    "CUSTOMER NUMBER" VARCHAR(255),
    "SKU CODE" VARCHAR(255),
    "LOYALTY SALES" NUMERIC,
    "QTY SOLD" NUMERIC,
    
    -- Standard audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
-- Enable RLS to prevent unauthorized access from public clients (anon keys)
ALTER TABLE bronze_loyalty_sales ENABLE ROW LEVEL SECURITY;

-- If your frontend needs to read this data directly (authenticated users only):
CREATE POLICY "Allow authenticated read access" 
ON bronze_loyalty_sales 
FOR SELECT TO authenticated USING (true);

-- Note: Your Express backend will likely use the Supabase Service Role Key 
-- to upload data, which automatically bypasses RLS. If your frontend uploads 
-- directly to Supabase, you would also need an INSERT policy here.

-- Note: In Silver layer development, records will be pulled from this Bronze table,
-- processed for business anomalies, and then stored in a Silver table.
