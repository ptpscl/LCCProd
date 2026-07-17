import { Router } from 'express';
import { spawn } from 'child_process';
import { initializeLoyaltyTables, pool } from '../../db/init.js';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { from as copyFrom } from 'pg-copy-streams';

const router = Router();
const upload = multer({ dest: 'tmp/' });

// ==========================================
// DATASET: LOYALTY SALES (BRONZE LAYER)
// ==========================================

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // 1. Automatically create tables if they don't exist!
    await initializeLoyaltyTables();

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: "DATABASE_URL is not configured." });
    }

    // 2. Spawn python process for schema validation
    const pythonScript = path.join(process.cwd(), 'backend', 'python', 'loyalty', 'bronze_schema.py');
    const pythonProcess = spawn('python3', [pythonScript, req.file.path]);
    
    let pythonOut = '';
    let pythonErr = '';

    pythonProcess.stdout.on('data', (chunk) => {
      pythonOut += chunk.toString();
    });

    pythonProcess.stderr.on('data', (chunk) => {
      pythonErr += chunk.toString();
    });

    pythonProcess.on('close', async (code) => {
      // Clean up the original uploaded file
      fs.unlink(req.file!.path, () => {});

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

        const cleanFilePath = result.clean_file;
        if (!cleanFilePath || !fs.existsSync(cleanFilePath)) {
           return res.status(500).json({ error: "Validation script did not produce a clean file." });
        }

        // 3. Insert into Supabase (bronze_loyalty_sales table) using fast copy-stream
        const client = await pool.connect();
        try {
          const stream = client.query(copyFrom(`
            COPY bronze_loyalty_sales (
              "DATE", "TRANSACTION NUMBER", "REGISTER NUMBER", "STORE CODE", 
              "STORE CATEGORIZATION", "CUSTOMER NUMBER", "SKU CODE", 
              "LOYALTY SALES", "QTY SOLD"
            ) FROM STDIN WITH (FORMAT csv, HEADER true)
          `));
          
          const fileStream = fs.createReadStream(cleanFilePath);
          
          fileStream.on('error', (error) => {
            console.error("File stream error:", error);
            res.status(500).json({ error: "Failed to read clean file." });
            client.release();
          });
          
          stream.on('error', (error) => {
            console.error("Database COPY error:", error);
            res.status(500).json({ error: "Database bulk insert failed.", details: error.message });
            client.release();
          });
          
          stream.on('finish', () => {
            res.json({
              success: true,
              layer: 'bronze',
              dataset: 'loyalty-sales',
              message: 'Loyalty sales data validated and uploaded to Bronze layer using fast streaming.',
              processed: result.processed
            });
            client.release();
            fs.unlink(cleanFilePath, () => {}); // clean up processed file
          });
          
          fileStream.pipe(stream);
          
        } catch (dbError: any) {
          console.error("Database insert error:", dbError);
          res.status(500).json({ error: "Failed to insert into database.", details: dbError.message });
          client.release();
          fs.unlink(cleanFilePath, () => {}); // clean up processed file
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
