import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.NEXT_PUBLIC_SUPABASE_URL || (import.meta as any).env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta as any).env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

/*
  SQL Snippet for Supabase Setup:

  -- 1. Create the bucket
  insert into storage.buckets (id, name, public) values ('bronze-raw', 'bronze-raw', false);

  -- 2. Create the table
  create table batches (
    id uuid primary key default gen_random_uuid(),
    store_code text not null,
    month text not null,
    file_name text not null,
    file_path text not null,
    row_count int,
    status text not null,
    uploaded_by text not null,
    created_at timestamptz default now()
  );
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

    // 5. "Registering batch…" -> REAL: insert a row into the "batches" table
    onProgress('Registering batch...');
    const { data: insertData, error: insertError } = await supabase.from('batches').insert({
      store_code: storeCode,
      month,
      file_name: file.name,
      file_path: path,
      row_count: null, // Could parse client-side, but leaving null for now as per instructions (can sum later)
      status: 'Success',
      uploaded_by: uploadedBy
    }).select().single();

    if (insertError) {
      throw new Error(`Failed to register batch: ${insertError.message}`);
    }

    return insertData as BronzeBatch;
  },

  async listBatches({ storeCode }: { storeCode?: string } = {}): Promise<BronzeBatch[]> {
    let query = supabase.from('batches').select('*').order('created_at', { ascending: false });
    if (storeCode) {
      query = query.eq('store_code', storeCode);
    }
    const { data, error } = await query;
    if (error) {
      console.error("Error fetching batches:", error);
      return [];
    }
    return data as BronzeBatch[];
  }
};
