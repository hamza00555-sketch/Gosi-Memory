import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

let client: SupabaseClient | null = null;

/**
 * Lazily create a single Supabase client. Returns null when the project is not
 * configured, which lets the app fall back to the local adapter cleanly.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}
