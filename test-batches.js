import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS batches (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          store_code VARCHAR(255),
          month VARCHAR(255),
          file_name VARCHAR(255),
          file_path TEXT,
          uploaded_by VARCHAR(255),
          status VARCHAR(255),
          row_count INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
      ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
    `);
    console.log('Batches table created.');
    
    await pool.query(`
      CREATE POLICY "Allow authenticated insert to batches" ON batches FOR INSERT TO authenticated WITH CHECK (true);
    `);
    console.log('Insert policy created.');
    
    await pool.query(`
      CREATE POLICY "Allow authenticated read to batches" ON batches FOR SELECT TO authenticated USING (true);
    `);
    console.log('Read policy created.');
  } catch (err) {
    console.error(err.message);
  } finally {
    pool.end();
  }
}
run();
