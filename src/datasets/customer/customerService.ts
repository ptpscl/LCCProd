import { supabase } from '../../auth/authService';

const ENGINE_URL = (import.meta as any).env.VITE_INGESTION_ENGINE_URL || 'https://lccprod-production.up.railway.app';

export interface CustomerBatch {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  row_count: number | null;
  status: string;
  uploaded_by: string;
  created_at: string;
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body.detail || fallback;
  } catch {
    return fallback;
  }
}

export async function uploadCustomerBatch(file: File, uploadedBy: string): Promise<CustomerBatch> {
  const path = `customer-database/${Date.now()}_${file.name}`;
  const uploaded = await supabase.storage.from('bronze-raw').upload(path, file, { upsert: false });
  if (uploaded.error) throw new Error(`Storage upload failed: ${uploaded.error.message}`);

  const inserted = await supabase.from('customer_batches').insert({
    file_name: file.name,
    file_path: path,
    file_size_bytes: file.size,
    uploaded_by: uploadedBy,
    status: 'uploaded',
    row_count: null,
  }).select().single();
  if (inserted.error) {
    await supabase.storage.from('bronze-raw').remove([path]);
    throw new Error(`Batch creation failed: ${inserted.error.message}`);
  }

  const response = await fetch(`${ENGINE_URL}/customer/ingest/${inserted.data.id}`, { method: 'POST' });
  if (!response.ok) throw new Error(await responseError(response, 'Customer validation failed'));
  const ingestion = await response.json();
  return { ...inserted.data, status: ingestion.status, row_count: ingestion.rows_ingested } as CustomerBatch;
}

export async function listCustomerBatches(): Promise<CustomerBatch[]> {
  const result = await supabase.from('customer_batches').select('*').order('created_at', { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return result.data as CustomerBatch[];
}

export interface CustomerRowParams {
  customer_number?: string;
  city?: string;
  province?: string;
  page?: number;
  page_size?: number;
}

function queryString(params: CustomerRowParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
}

export async function getCustomerRows(params: CustomerRowParams) {
  const response = await fetch(`${ENGINE_URL}/customer/bronze/rows?${queryString(params)}`);
  if (!response.ok) throw new Error(await responseError(response, 'Failed to load customer rows'));
  return response.json();
}

export async function exportCustomerRows(params: CustomerRowParams) {
  const response = await fetch(`${ENGINE_URL}/customer/bronze/export?${queryString(params)}`);
  if (!response.ok) throw new Error(await responseError(response, 'Export failed'));
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'customer_export.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
