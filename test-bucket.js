import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      INSERT INTO storage.buckets (id, name, public) 
      VALUES ('bronze-raw', 'bronze-raw', false) 
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Bucket created.');
    
    await pool.query(`
      CREATE POLICY "Allow authenticated uploads" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'bronze-raw');
    `);
    console.log('Policy created.');
  } catch (err) {
    console.error(err.message);
  } finally {
    pool.end();
  }
}
run();
