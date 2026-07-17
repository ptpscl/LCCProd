import { Router } from 'express';
import { spawn } from 'child_process';
import { initializeLoyaltyTables, pool } from '../../db/init.js';
import path from 'path';

const router = Router();

// ==========================================
// DATASET: LOYALTY SALES (BRONZE LAYER)
// ==========================================

router.post('/upload', async (req, res) => {
  try {
    // 1. Automatically create tables if they don't exist!
    await initializeLoyaltyTables();

    const { data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array of records." });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: "DATABASE_URL is not configured." });
    }

    // 2. Spawn python process for schema validation
    const pythonScript = path.join(process.cwd(), 'backend', 'python', 'loyalty', 'bronze_schema.py');
    const pythonProcess = spawn('python3', [pythonScript, JSON.stringify(data)]);
    
    let pythonOut = '';
    let pythonErr = '';

    pythonProcess.stdout.on('data', (chunk) => {
      pythonOut += chunk.toString();
    });

    pythonProcess.stderr.on('data', (chunk) => {
      pythonErr += chunk.toString();
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error("Python error:", pythonErr);
        return res.status(500).json({ error: "Validation script failed.", details: pythonErr });
      }

      try {
        const result = JSON.parse(pythonOut);
        
        if (result.status === 'failed_schema_check') {
          return res.status(400).json({ 
            success: false,
            message: result.message || "Schema validation failed",
            errors: result.errors 
          });
        }

        // 3. Insert into Supabase (bronze_loyalty_sales table)
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          for (const row of data) {
            await client.query(`
              INSERT INTO bronze_loyalty_sales (
                "DATE", "TRANSACTION NUMBER", "REGISTER NUMBER", "STORE CODE", 
                "STORE CATEGORIZATION", "CUSTOMER NUMBER", "SKU CODE", 
                "LOYALTY SALES", "QTY SOLD"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              row["DATE"] || null,
              row["TRANSACTION NUMBER"] || null,
              row["REGISTER NUMBER"] || null,
              row["STORE CODE"] || null,
              row["STORE CATEGORIZATION"] || null,
              row["CUSTOMER NUMBER"] || null,
              row["SKU CODE"] || null,
              row["LOYALTY SALES"] || null,
              row["QTY SOLD"] || null
            ]);
          }
          
          await client.query('COMMIT');
          
          res.json({
            success: true,
            layer: 'bronze',
            dataset: 'loyalty-sales',
            message: 'Loyalty sales data validated and uploaded to Bronze layer.',
            processed: result.processed
          });
        } catch (dbError: any) {
          await client.query('ROLLBACK');
          console.error("Database insert error:", dbError);
          res.status(500).json({ error: "Failed to insert into database.", details: dbError.message });
        } finally {
          client.release();
        }

      } catch (parseError: any) {
        res.status(500).json({ error: "Failed to parse Python output.", output: pythonOut });
      }
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
