import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loyalty_batches (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          file_name VARCHAR(255),
          file_path TEXT,
          uploaded_by VARCHAR(255),
          status VARCHAR(255),
          row_count INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
      ALTER TABLE loyalty_batches ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Allow authenticated insert to loyalty_batches" ON loyalty_batches;
      CREATE POLICY "Allow authenticated insert to loyalty_batches" ON loyalty_batches FOR INSERT TO authenticated WITH CHECK (true);
      
      DROP POLICY IF EXISTS "Allow authenticated read to loyalty_batches" ON loyalty_batches;
      CREATE POLICY "Allow authenticated read to loyalty_batches" ON loyalty_batches FOR SELECT TO authenticated USING (true);
    `);
    console.log('loyalty_batches table created.');
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
  } catch (err) {
    console.error(err.message);
  } finally {
    pool.end();
  }
}
run();
