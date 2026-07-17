import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

// This will use the DATABASE_URL environment variable from Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase connections
});

export async function initializeLoyaltyTables() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Skipping automatic table creation.");
    return;
  }

  const client = await pool.connect();
  try {
    const bronzeSql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'loyalty_bronze_schema.sql'), 'utf8');
    const silverSql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'loyalty_silver_schema.sql'), 'utf8');
    
    // Execute the SQL to create tables if they don't exist
    await client.query(bronzeSql);
    await client.query(silverSql);
    
    console.log("Loyalty tables verified/created successfully.");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    client.release();
  }
}
