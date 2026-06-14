import { env } from '../config/env';
import { LocalGameService } from './local/LocalGameService';
import { SupabaseGameService } from './supabase/SupabaseGameService';
import { getSupabaseClient } from './supabase/client';
import type { GameService } from './types';

let instance: GameService | null = null;

/**
 * Single entry point for the rest of the app. Picks the adapter from env and
 * memoizes it. Components import this — never a concrete adapter — so swapping
 * backends is a config change, not a refactor.
 */
export function getGameService(): GameService {
  if (instance) return instance;
  if (env.backendMode === 'supabase') {
    const db = getSupabaseClient();
    if (db) {
      instance = new SupabaseGameService(db);
      return instance;
    }
  }
  instance = new LocalGameService();
  return instance;
}

export type { GameService } from './types';
export * from './types';
