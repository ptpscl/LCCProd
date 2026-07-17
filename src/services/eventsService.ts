import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.NEXT_PUBLIC_SUPABASE_URL || (import.meta as any).env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta as any).env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

/*
  CREATE TABLE IF NOT EXISTS events (
    id uuid primary key default gen_random_uuid(),
    type text not null,
    dataset text not null,
    detail text not null,
    actor text not null,
    created_at timestamptz default now()
  );
*/

export interface AppEvent {
  id: string;
  created_at: string;
  type: string;
  dataset: string;
  detail: string;
  actor: string;
}

export const eventsService = {
  async logEvent({ type, dataset, detail, actor }: { type: string, dataset: string, detail: string, actor: string }) {
    const { error } = await supabase.from('events').insert({
      type,
      dataset,
      detail,
      actor
    });
    if (error) {
      console.error('Failed to log event', error);
      throw error;
    }
  },

  async listEvents({ limit = 100 }: { limit?: number } = {}): Promise<AppEvent[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to list events', error);
      throw error;
    }
    return data || [];
  }
};
