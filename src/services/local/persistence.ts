import type { Game } from '../../core/types/game';
import type { Room } from '../../core/types/room';

/**
 * Tiny localStorage-backed persistence so an offline room/game survives a
 * browser refresh (satisfies "handle refresh/reconnect without destroying the
 * room" for the local adapter). No-ops gracefully when storage is unavailable.
 */
const KEY = 'qawsi:local-state:v1';

export interface PersistedState {
  rooms: Record<string, Room>;
  games: Record<string, Game>;
}

function emptyState(): PersistedState {
  return { rooms: {}, games: {} };
}

export function loadState(): PersistedState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as PersistedState;
    return { rooms: parsed.rooms ?? {}, games: parsed.games ?? {} };
  } catch {
    return emptyState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private-mode errors; in-memory state still works.
  }
}
