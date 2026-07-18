import { supabase } from '../../auth/authService';

export interface CustomerBatch {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  row_count: number | null;
  status: 'uploaded' | 'processing' | 'ingested' | 'validation_failed' | 'ingestion_failed';
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerUploadResult {
  batch: CustomerBatch;
  storagePath: string;
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadCustomerBatch(
  file: File,
  uploadedBy: string,
): Promise<CustomerUploadResult> {
  const objectName = `${Date.now()}_${crypto.randomUUID()}_${safeFileName(file.name)}`;
  const storagePath = `customer-database/${objectName}`;

  const storageResult = await supabase.storage
    .from('bronze-raw')
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'text/csv',
      upsert: false,
    });

  if (storageResult.error || !storageResult.data?.path) {
    throw new Error(`Storage upload failed: ${storageResult.error?.message || 'No object path returned'}`);
  }

  const batchResult = await supabase
    .from('customer_batches')
    .insert({
      file_name: file.name,
      file_path: storageResult.data.path,
      file_size_bytes: file.size,
      row_count: null,
      status: 'uploaded',
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single();

  if (batchResult.error || !batchResult.data) {
    // Do not leave an untracked object when batch creation fails.
    await supabase.storage.from('bronze-raw').remove([storageResult.data.path]);
    throw new Error(`Batch creation failed: ${batchResult.error?.message || 'No batch row returned'}`);
  }

  if (batchResult.data.file_path !== storageResult.data.path) {
    throw new Error('Upload verification failed: batch path does not match the stored object path.');
  }

  return {
    batch: batchResult.data as CustomerBatch,
    storagePath: storageResult.data.path,
  };
}
