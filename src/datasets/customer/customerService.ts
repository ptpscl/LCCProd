import { supabase } from '../../auth/authService';

const ENGINE_URL = (import.meta as any).env.VITE_INGESTION_ENGINE_URL
  || 'https://lccprod-production.up.railway.app';
const CUSTOMER_API_URL = `${ENGINE_URL}/customer`;

export interface CustomerBatch {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  row_count: number | null;
  status: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerFilters {
  customer_number?: string;
  city?: string;
  province?: string;
  member_location?: string;
  last_visited_store?: string;
  page?: number;
  page_size?: number;
}

async function apiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body.detail || body.message || fallback;
  } catch {
    return fallback;
  }
}

function queryString(filters: CustomerFilters): string {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadCustomerBatch(file: File, uploadedBy: string): Promise<CustomerBatch> {
  const path = `customer-database/${Date.now()}_${crypto.randomUUID()}_${safeFileName(file.name)}`;
  const storage = await supabase.storage.from('bronze-raw').upload(path, file, {
    contentType: file.type || 'text/csv',
    upsert: false,
  });
  if (storage.error || !storage.data?.path) {
    throw new Error(`Storage upload failed: ${storage.error?.message || 'No path returned'}`);
  }

  const batch = await supabase.from('customer_batches').insert({
    file_name: file.name,
    file_path: storage.data.path,
    file_size_bytes: file.size,
    row_count: null,
    status: 'uploaded',
    uploaded_by: uploadedBy,
  }).select('*').single();

  if (batch.error || !batch.data) {
    await supabase.storage.from('bronze-raw').remove([storage.data.path]);
    throw new Error(`Batch creation failed: ${batch.error?.message || 'No row returned'}`);
  }
  return batch.data as CustomerBatch;
}

export async function listCustomerBatches(): Promise<CustomerBatch[]> {
  const response = await supabase
    .from('customer_batches')
    .select('*')
    .order('created_at', { ascending: false });
  if (response.error) throw new Error(`Failed to load Customer batches: ${response.error.message}`);
  return response.data as CustomerBatch[];
}

export async function ingestCustomerBatch(batchId: string) {
  const response = await fetch(`${CUSTOMER_API_URL}/ingest/${batchId}`, { method: 'POST' });
  if (!response.ok) throw new Error(await apiError(response, 'Customer ingestion failed'));
  return response.json();
}

export async function getCustomerBatchStatus(batchId: string) {
  const response = await fetch(`${CUSTOMER_API_URL}/ingest/${batchId}/status`);
  if (!response.ok) throw new Error(await apiError(response, 'Failed to load Customer batch status'));
  return response.json();
}

export async function getCustomerStats(): Promise<{ total_rows: number; last_updated: string | null }> {
  const response = await fetch(`${CUSTOMER_API_URL}/bronze/stats`);
  if (!response.ok) throw new Error(await apiError(response, 'Failed to load Customer statistics'));
  return response.json();
}

export async function getCustomerRows(filters: CustomerFilters) {
  const response = await fetch(`${CUSTOMER_API_URL}/bronze/rows?${queryString(filters)}`);
  if (!response.ok) throw new Error(await apiError(response, 'Failed to load Customer rows'));
  return response.json();
}

export async function exportCustomerRows(filters: CustomerFilters): Promise<void> {
  const response = await fetch(`${CUSTOMER_API_URL}/bronze/export?${queryString(filters)}`);
  if (!response.ok) throw new Error(await apiError(response, 'Customer export failed'));
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'customer_bronze_export.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
