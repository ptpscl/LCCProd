import { spawn } from 'node:child_process';
import path from 'node:path';
import { Router } from 'express';

const router = Router();
const MAX_VALIDATOR_OUTPUT_BYTES = 10 * 1024 * 1024;

interface ValidationResult {
  status: 'success' | 'error';
  processed?: number;
  anomalies?: number;
  columns?: string[];
  data?: unknown[];
  error?: string;
}

function validateCustomers(data: unknown): Promise<ValidationResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), 'backend', 'python', 'customer', 'validation.py');
    const pythonCommand = process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3');
    const child = spawn(pythonCommand, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => child.kill(), 30_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > MAX_VALIDATOR_OUTPUT_BYTES) child.kill();
    });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Could not start customer validator: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      try {
        const result = JSON.parse(stdout) as ValidationResult;
        if (code !== 0 || result.status === 'error') {
          reject(new Error(result.error || stderr.trim() || 'Customer validation failed'));
          return;
        }
        resolve(result);
      } catch {
        reject(new Error(stderr.trim() || 'Customer validator returned an invalid response'));
      }
    });

    child.stdin.end(JSON.stringify(data));
  });
}

router.post('/upload', async (req, res) => {
  try {
    const { data } = req.body ?? {};
    if (!Array.isArray(data) || data.length === 0) {
      res.status(400).json({ success: false, error: 'data must be a non-empty array of customer records' });
      return;
    }

    const validation = await validateCustomers(data);
    res.json({
      success: true,
      layer: 'bronze',
      dataset: 'customer',
      message: 'Customer data successfully received and schema validated.',
      processed: validation.processed,
      anomalies_flagged: validation.anomalies,
      columns: validation.columns,
      records: validation.data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected customer upload error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
