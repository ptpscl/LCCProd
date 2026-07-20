import { supabase } from '../../auth/authService';

const INGESTION_ENGINE_URL = (import.meta as any).env.VITE_INGESTION_ENGINE_URL || 'https://lccprod-production.up.railway.app';
const SKU_API_URL = `${INGESTION_ENGINE_URL}/sku`;

export interface SkuBatch {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  row_count: number | null;
  file_row_count: number | null;
  duplicates_skipped: number | null;
  status: string;
  uploaded_by: string;
  created_at: string;
}

export async function uploadSkuBatch(file: File, userEmail: string): Promise<SkuBatch> {
  const fileName = file.name;
  const timestamp = new Date().getTime();
  const path = `sku-hierarchy/${timestamp}_${fileName}`;

  const { error: uploadError } = await supabase.storage.from('bronze-raw').upload(path, file, {
    upsert: true
  });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data, error: insertError } = await supabase.from('sku_batches').insert({
    file_name: fileName,
    file_path: path,
    file_size_bytes: file.size,
    uploaded_by: userEmail,
    status: 'uploaded',
    row_count: null
  }).select().single();

  if (insertError) {
    throw new Error(`Database insert failed: ${insertError.message}`);
  }

  return data as SkuBatch;
}

export async function listSkuBatches(): Promise<SkuBatch[]> {
  const { data, error } = await supabase
    .from('sku_batches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch batches: ${error.message}`);
  }

  return data as SkuBatch[];
}

export async function ingestBatch(batchId: string): Promise<any> {
  const res = await fetch(`${SKU_API_URL}/ingest/${batchId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    let detail = 'Ingestion failed';
    try {
      const errorData = await res.json();
      if (errorData && errorData.detail) {
        detail = errorData.detail;
      }
    } catch (e) {
      // Ignore
    }
    throw new Error(detail);
  }

  return await res.json();
}

export async function getBatchStatus(batchId: string): Promise<any> {
  const res = await fetch(`${SKU_API_URL}/ingest/${batchId}/status`);
  if (!res.ok) {
    throw new Error('Failed to fetch batch status');
  }
  return await res.json();
}

export async function getBronzeStats(): Promise<{ total_rows: number, last_updated: string | null }> {
  const res = await fetch(`${SKU_API_URL}/bronze/stats`);
  if (!res.ok) throw new Error('Failed to fetch bronze stats');
  return res.json();
}

export interface BronzeRowParams {
  sku_code?: string;
  division?: string;
  department?: string;
  brand?: string;
  page?: number;
  page_size?: number;
}

export async function getBronzeRows(params: BronzeRowParams): Promise<{
  rows: any[];
  page: number;
  page_size: number;
  total_matching_rows: number;
}> {
  const query = new URLSearchParams();
  if (params.sku_code) query.append('sku_code', params.sku_code);
  if (params.division) query.append('division', params.division);
  if (params.department) query.append('department', params.department);
  if (params.brand) query.append('brand', params.brand);
  if (params.page) query.append('page', params.page.toString());
  if (params.page_size) query.append('page_size', params.page_size.toString());

  const res = await fetch(`${SKU_API_URL}/bronze/rows?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch bronze rows');
  return res.json();
}

export async function exportBronzeRows(params: BronzeRowParams): Promise<void> {
  const query = new URLSearchParams();
  if (params.sku_code) query.append('sku_code', params.sku_code);
  if (params.division) query.append('division', params.division);
  if (params.department) query.append('department', params.department);
  if (params.brand) query.append('brand', params.brand);

  const res = await fetch(`${SKU_API_URL}/bronze/export?${query.toString()}`);

  if (!res.ok) {
    let detail = 'Export failed';
    try {
      const errorData = await res.json();
      if (errorData && errorData.detail) detail = errorData.detail;
    } catch (e) {}
    throw new Error(detail);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const contentDisposition = res.headers.get('Content-Disposition');
  let filename = 'sku_hierarchy_export.csv';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename=(.+)/);
    if (match) filename = match[1];
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
