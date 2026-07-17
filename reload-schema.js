import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('Schema cache reloaded.');
  } catch (err) {
    console.error(err.message);
  } finally {
    pool.end();
  }
}
run();
