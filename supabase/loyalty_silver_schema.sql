-- ==========================================
-- DATASET: LOYALTY SALES (SILVER LAYER)
-- OWNER: LOYALTY SALES TEAM
-- ==========================================

-- This table holds the processed data from the Bronze layer.
-- It includes tracking flags for anomalies and data quality issues.

CREATE TABLE IF NOT EXISTS silver_loyalty_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bronze_id UUID REFERENCES bronze_loyalty_sales(id), -- Link back to raw record
    
    -- Expected Schema Columns (Typed and cleaned)
    "DATE" DATE,
    "TRANSACTION NUMBER" VARCHAR(255),
    "REGISTER NUMBER" VARCHAR(255),
    "STORE CODE" VARCHAR(255),
    "STORE CATEGORIZATION" VARCHAR(255),
    "CUSTOMER NUMBER" VARCHAR(255),
    "SKU CODE" VARCHAR(255),
    "LOYALTY SALES" NUMERIC,
    "QTY SOLD" NUMERIC,
    
    -- Medallion architecture tracking metadata
    validation_status VARCHAR(50) DEFAULT 'unresolved', -- 'unresolved', 'clean', or 'resolved'
    anomaly_reason TEXT, -- Populated if status is 'unresolved' (e.g., "Negative QTY SOLD Flag")
    
    -- Standard audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
-- Enable RLS to prevent unauthorized access from public clients
ALTER TABLE silver_loyalty_sales ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view the records (especially needed for UI resolution)
CREATE POLICY "Allow authenticated read access" 
ON silver_loyalty_sales 
FOR SELECT TO authenticated USING (true);

-- Note: Records with status 'clean' or 'resolved' 
-- are considered safe to move to the Gold layer aggregations.
