const INGESTION_ENGINE_URL = (import.meta as any).env.VITE_INGESTION_ENGINE_URL || 'https://lccprod-production.up.railway.app';
const SILVER_API_URL = `${INGESTION_ENGINE_URL}/sku/silver`;

export interface SilverBatch {
  id: string;
  source_bronze_batch_id: string | null;
  status: string;               // processing | completed | failed
  step: string | null;
  silver_row_count: number | null;
  excluded_row_count: number | null;
  error_message: string | null;
  started_by: string | null;
  created_at: string;
  completed_at: string | null;
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && data.detail) return data.detail;
  } catch (e) { /* ignore */ }
  return fallback;
}

export async function startSilverProcessing(bronzeBatchId: string, startedBy: string): Promise<{ silver_batch_id: string }> {
  const res = await fetch(`${SILVER_API_URL}/process/${bronzeBatchId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ started_by: startedBy })
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to start silver processing'));
  return res.json();
}

export async function listSilverBatches(): Promise<SilverBatch[]> {
  const res = await fetch(`${SILVER_API_URL}/batches`);
  if (!res.ok) throw new Error(await parseError(res, 'Failed to fetch silver batches'));
  const data = await res.json();
  return data.batches as SilverBatch[];
}

export async function getSilverStatus(silverBatchId: string): Promise<SilverBatch> {
  const res = await fetch(`${SILVER_API_URL}/status/${silverBatchId}`);
  if (!res.ok) throw new Error(await parseError(res, 'Failed to fetch silver status'));
  return res.json();
}
