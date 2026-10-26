import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  !supabaseUrl.includes('your-project')
);

// Fallback dummy client if credentials are empty to avoid crash before demo mode activates
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured && supabaseUrl ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured && supabaseAnonKey ? supabaseAnonKey : 'placeholder-anon-key'
);
