import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Game } from '../core/types/game';
import type { PlayerId } from '../core/types/ids';

export interface MatchPlayer {
  id: PlayerId;
  name: string;
}

/**
 * The single live match. Persisted so an accidental refresh mid-game (easy to
 * do while waving a phone over a table) resumes instead of losing the round.
 * The Game snapshot itself is pure data — the engine owns all transitions.
 */
interface MatchState {
  game: Game | null;
  players: MatchPlayer[];
  setMatch: (game: Game, players: MatchPlayer[]) => void;
  updateGame: (game: Game) => void;
  clear: () => void;
}

export const useMatchStore = create<MatchState>()(
  persist(
    (set) => ({
      game: null,
      players: [],
      setMatch: (game, players) => set({ game, players }),
      updateGame: (game) => set({ game }),
      clear: () => set({ game: null, players: [] }),
    }),
    { name: 'gosi:match:v1' },
  ),
);

export function playerName(players: MatchPlayer[], id: PlayerId): string {
  return players.find((p) => p.id === id)?.name ?? id;
}
