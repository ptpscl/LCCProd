import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.NEXT_PUBLIC_SUPABASE_URL || (import.meta as any).env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta as any).env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

/*
  SQL Snippet for Supabase Setup:

  -- 1. Create the bucket
  insert into storage.buckets (id, name, public) values ('bronze-raw', 'bronze-raw', false);

  Files are the Bronze records and use this partition layout:
  <store_code>/<year>/<YYYY-MM>/<file_name>
*/

export interface BronzeBatch {
  id: string;
  store_code: string;
  month: string;
  file_name: string;
  file_path: string;
  row_count: number | null;
  status: string;
  uploaded_by: string;
  created_at: string;
}

export const bronzeService = {
  async uploadBatch({ storeCode, month, file, uploadedBy, onProgress }: { storeCode: string, month: string, file: File, uploadedBy: string, onProgress: (stage: string) => void }) {
    // 1. "Uploading raw file…"
    onProgress('Uploading raw file...');
    
    // Extract year from month ("YYYY-MM")
    const year = month.split('-')[0];
    const path = `${storeCode}/${year}/${month}/${file.name}`;
    
    const { error: uploadError } = await supabase.storage.from('bronze-raw').upload(path, file, {
      upsert: true,
    });
    
    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // 2. "Normalizing key fields…" -> SIMULATED (~1s)
    onProgress('Normalizing key fields...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    // TODO backend: cast/clean the 5 key fields

    // 3. "Converting to Parquet (partitioned by store/year/month)…" -> SIMULATED (~1s)
    onProgress('Converting to Parquet (partitioned by store/year/month)...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    // TODO backend: DuckDB

    // 4. "Stitching this store-month…" -> SIMULATED (~1s)
    onProgress('Stitching this store-month...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    // TODO backend: incremental upsert on the 5-key

    // The uploaded object itself is the Bronze batch record.
    onProgress('Upload complete');
    return {
      id: path,
      store_code: storeCode,
      month,
      file_name: file.name,
      file_path: path,
      row_count: null,
      status: 'Success',
      uploaded_by: uploadedBy,
      created_at: new Date().toISOString(),
    } satisfies BronzeBatch;
  },

  async listBatches({ storeCode }: { storeCode?: string } = {}): Promise<BronzeBatch[]> {
    const bucket = supabase.storage.from('bronze-raw');
    const batches: BronzeBatch[] = [];

    const walk = async (prefix: string): Promise<void> => {
      const { data, error } = await bucket.list(prefix, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`Failed to list Data Lake files: ${error.message}`);

      for (const object of data ?? []) {
        const objectPath = prefix ? `${prefix}/${object.name}` : object.name;
        if (!object.id) {
          await walk(objectPath);
          continue;
        }

        const parts = objectPath.split('/');
        const objectStore = parts[0];
        const usesPartitionedPath = parts.length >= 4;
        const objectMonth = usesPartitionedPath ? parts[2] : '';
        const fileParts = usesPartitionedPath ? parts.slice(3) : parts.slice(1);
        if (!objectStore || fileParts.length === 0) continue;
        if (storeCode && objectStore !== storeCode) continue;

        batches.push({
          id: object.id,
          store_code: objectStore,
          month: objectMonth,
          file_name: fileParts.join('/'),
          file_path: objectPath,
          row_count: null,
          status: 'Success',
          uploaded_by: 'Data Lake',
          created_at: object.created_at ?? object.updated_at ?? '',
        });
      }
    };

    await walk(storeCode ?? '');
    return batches.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
};
