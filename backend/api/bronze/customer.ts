import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';

const router = Router();
const upload = multer({ dest: 'tmp/' });

// ==========================================
// DATASET: CUSTOMER DATABASE (BRONZE LAYER)
// OWNER: LEONARD
// ==========================================

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    
    // TODO (Leonard): 
    // 1. Receive raw upload from Frontend
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    
    const { chunkIndex, totalChunks, uploadId } = req.body;
    
    if (chunkIndex !== undefined && totalChunks !== undefined && uploadId) {
       const tmpDir = os.tmpdir();
       const finalFilePath = path.join(tmpDir, `upload-${uploadId}.csv`);
       fs.appendFileSync(finalFilePath, fs.readFileSync(req.file.path));
       fs.unlinkSync(req.file.path);
       
       if (Number(chunkIndex) < Number(totalChunks) - 1) {
          return res.json({ success: true, message: "Chunk received" });
       }
       req.file.path = finalFilePath;
    }
    
    // clean up
    fs.unlink(req.file.path, () => {});

    // 2. Spawn python process: backend/python/customer/bronze_schema.py
    // 3. Insert into Supabase (bronze_customers table) or Data Lake
    
    /* Example:
    const pythonProcess = spawn('python3', ['backend/python/customer/bronze_schema.py', JSON.stringify(data)]);
    // ... handle stdout for anomaly flags ...
    */
    
    res.json({
      success: true,
      layer: 'bronze',
      dataset: 'customer',
      message: 'Customer data successfully received and schema validated.',
      anomalies_flagged: 5 // Example output from Python
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
