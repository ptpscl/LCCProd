import { supabase } from '../../auth/authService';

const CONFIGURED_INGESTION_ENGINE_URL = (import.meta as any).env.VITE_INGESTION_ENGINE_URL;
const INGESTION_ENGINE_URL = typeof CONFIGURED_INGESTION_ENGINE_URL === 'string'
  ? CONFIGURED_INGESTION_ENGINE_URL.trim().replace(/\/+$/, '')
  : '';
const MMS_API_URL = INGESTION_ENGINE_URL ? `${INGESTION_ENGINE_URL}/mms` : '';
const BRONZE_BUCKET = 'bronze-raw';

export type MmsStoredStatus =
  | 'uploaded'
  | 'ingested'
  | 'ingestion_failed'
  | 'invalid_multi_store'
  | 'invalid_multi_month'
  | 'duplicate_suspected';

export type MmsIngestionResponseStatus =
  | 'ingested'
  | 'duplicate_suspected'
  | 'already_ingested';

export interface MmsBatch {
  id: string;
  file_name: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  row_count: number | null;
  status: MmsStoredStatus | null;
  uploaded_by: string | null;
  created_at: string | null;
  store_code: string | null;
  year_month: string | null;
}

export interface MmsBatchListResult {
  batches: MmsBatch[];
  total_count: number;
}

interface MmsIngestionResultBase<Status extends MmsIngestionResponseStatus> {
  batch_id: string;
  status: Status;
  rows_ingested: number;
}

export type MmsIngestionResult =
  | MmsIngestionResultBase<'ingested'>
  | MmsIngestionResultBase<'already_ingested'>
  | (MmsIngestionResultBase<'duplicate_suspected'> & {
    existing_batch_id: string;
    store_code: string;
    year_month: string;
  });

export interface MmsBatchStatus {
  batch_id: string;
  status: MmsStoredStatus | null;
  row_count: number | null;
  store_code: string | null;
  year_month: string | null;
}

export interface MmsBronzeStats {
  total_rows: number;
  last_updated: string | null;
}

export interface MmsBronzeFilters {
  store_code?: string;
  date_from?: string;
  date_to?: string;
  sku_code?: string;
}

export interface MmsBronzeRowParams extends MmsBronzeFilters {
  page?: number;
  page_size?: number;
}

export interface MmsBronzeRowsResponse {
  rows: MmsBronzeRow[];
  page: number;
  page_size: number;
  total_matching_rows: number;
}

export type MmsNumericValue = string | number;

export interface MmsBronzeRow {
  id: string | number;
  DATE: string;
  TRANSACTION_NUMBER: string;
  REGISTER_NUMBER: string;
  STORE_CODE: string;
  STORE_CATEGORIZATION: string;
  SKU_CODE: string;
  TRANSACTION_TYPE: string;
  MMS_SALES: MmsNumericValue;
  QTY_SOLD: MmsNumericValue;
  MARGIN: MmsNumericValue;
  source_batch_id: string;
  loaded_at: string;
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function apiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // The fallback deliberately avoids exposing an unexpected raw response body.
  }
  return fallback;
}

function filterQuery(filters: MmsBronzeFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.store_code) query.set('store_code', filters.store_code);
  if (filters.date_from) query.set('date_from', filters.date_from);
  if (filters.date_to) query.set('date_to', filters.date_to);
  if (filters.sku_code) query.set('sku_code', filters.sku_code);
  return query;
}

function mmsApiUrl(path: string): string {
  if (!MMS_API_URL) {
    throw new Error('MMS ingestion engine URL is not configured');
  }
  return `${MMS_API_URL}${path}`;
}

export async function uploadMmsBatch(file: File, uploadedBy: string): Promise<MmsBatch> {
  const batchId = crypto.randomUUID();
  const path = `mms/${batchId}/${safeFileName(file.name)}`;
  const storage = await supabase.storage.from(BRONZE_BUCKET).upload(path, file, {
    contentType: file.type || 'text/csv',
    upsert: false,
  });

  if (storage.error || !storage.data?.path) {
    throw new Error(`MMS Storage upload failed: ${storage.error?.message || 'No object path returned'}`);
  }

  const batch = await supabase.from('mms_batches').insert({
    id: batchId,
    file_name: file.name,
    file_path: storage.data.path,
    file_size_bytes: file.size,
    row_count: null,
    status: 'uploaded',
    uploaded_by: uploadedBy,
    store_code: null,
    year_month: null,
  }).select('*').single();

  if (batch.error || !batch.data) {
    try {
      const cleanup = await supabase.storage.from(BRONZE_BUCKET).remove([storage.data.path]);
      if (cleanup.error) {
        console.warn('MMS Storage cleanup could not be completed');
      }
    } catch {
      // Cleanup is best-effort; preserve the batch-creation failure for the user.
    }
    throw new Error(`MMS batch creation failed: ${batch.error?.message || 'No batch row returned'}`);
  }

  return batch.data as MmsBatch;
}

export async function listMmsBatches(): Promise<MmsBatchListResult> {
  const response = await supabase
    .from('mms_batches')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);
  if (response.error) {
    throw new Error(`Failed to load MMS batches: ${response.error.message}`);
  }
  return {
    batches: response.data as MmsBatch[],
    total_count: response.count ?? 0,
  };
}

export async function ingestMmsBatch(batchId: string): Promise<MmsIngestionResult> {
  const response = await fetch(mmsApiUrl(`/ingest/${encodeURIComponent(batchId)}`), {
    method: 'POST',
  });
  if (!response.ok) throw new Error(await apiError(response, 'MMS ingestion failed'));
  return response.json();
}

export async function getMmsBatchStatus(batchId: string): Promise<MmsBatchStatus> {
  const response = await fetch(mmsApiUrl(`/ingest/${encodeURIComponent(batchId)}/status`));
  if (!response.ok) {
    throw new Error(await apiError(response, 'Failed to load MMS batch status'));
  }
  return response.json();
}

export async function getMmsBronzeStats(): Promise<MmsBronzeStats> {
  const response = await fetch(mmsApiUrl('/bronze/stats'));
  if (!response.ok) {
    throw new Error(await apiError(response, 'Failed to load MMS Bronze statistics'));
  }
  return response.json();
}

export async function getMmsBronzeRows(
  params: MmsBronzeRowParams,
): Promise<MmsBronzeRowsResponse> {
  const query = filterQuery(params);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.page_size !== undefined) query.set('page_size', String(params.page_size));

  const response = await fetch(mmsApiUrl(`/bronze/rows?${query.toString()}`));
  if (!response.ok) {
    throw new Error(await apiError(response, 'Failed to load MMS Bronze rows'));
  }
  return response.json();
}

export async function exportMmsBronzeRows(filters: MmsBronzeFilters): Promise<void> {
  const query = filterQuery(filters);
  const response = await fetch(mmsApiUrl(`/bronze/export?${query.toString()}`));
  if (!response.ok) {
    throw new Error(await apiError(response, 'MMS Bronze export failed'));
  }

  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;

  const contentDisposition = response.headers.get('Content-Disposition');
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  anchor.download = safeFileName(match?.[1] || 'mms_bronze_export.csv');

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
