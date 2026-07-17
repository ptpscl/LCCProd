import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.query('SELECT * FROM bronze_loyalty_sales LIMIT 1', (err, res) => {
  console.log(err || res.rows);
  pool.end();
});
