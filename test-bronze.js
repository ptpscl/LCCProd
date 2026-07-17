import pkg from 'pg';
import fs from 'fs';
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const bronzeSql = fs.readFileSync('supabase/loyalty_bronze_schema.sql', 'utf8');
    await pool.query(bronzeSql);
    console.log('Bronze schema run successfully.');
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('Schema reloaded.');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
