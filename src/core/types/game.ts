import type { Card } from './card';
import type { CardId, EpochMs, GameId, PlayerId, SetId } from './ids';
import type { GameMode } from './config';

export type GameStatus = 'in_progress' | 'completed';

/**
 * Turn lifecycle inside a single game. Modelled explicitly so the engine is a
 * predictable state machine rather than a tangle of booleans.
 *
 * - selecting_first  : active player must flip (scan) their first card
 * - selecting_second : one card is face-up, waiting for the second flip
 * - resolving        : two cards are face-up; outcome is computed and shown
 *                      briefly before being acknowledged (END_REVEAL)
 * - completed        : game over, see winner fields
 */
export type GamePhase =
  | 'selecting_first'
  | 'selecting_second'
  | 'resolving'
  | 'completed';

export interface ScoreEntry {
  playerId: PlayerId;
  score: number;
  matchedPairs: number;
}

export interface Game {
  id: GameId;
  mode: GameMode;
  /** Which content set (printed deck) this match is played with. */
  setId: SetId;
  status: GameStatus;
  phase: GamePhase;

  /** Monotonic counter; every applied action increments it. Guards races. */
  version: number;
  /** Monotonic turn index, increments on every turn pass. */
  turnIndex: number;
  /** Total two-card attempts resolved (solo efficiency metric). */
  moveCount: number;

  currentTurnPlayerId: PlayerId;
  /** Stable rotation order of players for turn passing. */
  turnOrder: PlayerId[];

  deck: Card[];
  /** Card ids face-up this turn (max 2). Cleared after each resolution. */
  selection: CardId[];

  scores: ScoreEntry[];

  winnerId: PlayerId | null;

  startedAt: EpochMs;
  endedAt: EpochMs | null;
}
