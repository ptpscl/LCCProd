import { supabase } from '../../auth/authService';

const INGESTION_ENGINE_URL = import.meta.env.VITE_INGESTION_ENGINE_URL || 'https://lccprod-production.up.railway.app';

export interface LoyaltyBatch {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  row_count: number | null;
  status: string;
  uploaded_by: string;
  created_at: string;
  store_code?: string | null;
  year_month?: string | null;
}

export async function uploadLoyaltyBatch(file: File, userEmail: string): Promise<LoyaltyBatch> {
  const fileName = file.name;
  const timestamp = new Date().getTime();
  const path = `loyalty-sales/${timestamp}_${fileName}`;
  
  const { error: uploadError } = await supabase.storage.from('bronze-raw').upload(path, file, { 
    upsert: true 
  });
  
  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data, error: insertError } = await supabase.from('loyalty_batches').insert({
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

  return data as LoyaltyBatch;
}

export async function listLoyaltyBatches(): Promise<LoyaltyBatch[]> {
  const { data, error } = await supabase
    .from('loyalty_batches')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    throw new Error(`Failed to fetch batches: ${error.message}`);
  }
  
  return data as LoyaltyBatch[];
}

export async function ingestBatch(batchId: string): Promise<any> {
  const res = await fetch(`${INGESTION_ENGINE_URL}/ingest/${batchId}`, {
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
  const res = await fetch(`${INGESTION_ENGINE_URL}/ingest/${batchId}/status`);
  if (!res.ok) {
    throw new Error('Failed to fetch batch status');
  }
  return await res.json();
}
