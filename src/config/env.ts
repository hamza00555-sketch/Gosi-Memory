/**
 * Centralized, validated access to build-time env. Vite exposes only
 * VITE_-prefixed vars to the client. The anon key is safe in the browser
 * because Row Level Security, not secrecy, protects the data.
 */
export type BackendMode = 'local' | 'supabase';

interface AppEnv {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  backendMode: BackendMode;
}

function read(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value && value.length > 0 ? value : undefined;
}

const supabaseUrl = read('VITE_SUPABASE_URL');
const supabaseAnonKey = read('VITE_SUPABASE_ANON_KEY');

// Fall back to local whenever Supabase is not fully configured.
const requested = read('VITE_BACKEND_MODE') as BackendMode | undefined;
const backendMode: BackendMode =
  requested === 'supabase' && supabaseUrl && supabaseAnonKey ? 'supabase' : 'local';

export const env: AppEnv = { supabaseUrl, supabaseAnonKey, backendMode };

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
