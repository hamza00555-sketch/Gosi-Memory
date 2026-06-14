import type { Card } from './card';
import type {
  CardId,
  EpochMs,
  GameId,
  PlayerId,
  RoomId,
  TeamId,
  WordId,
} from './ids';
import type { Phrase } from './phrase';
import type { GameMode } from './room';

export type GameStatus = 'in_progress' | 'completed';

/**
 * Turn lifecycle inside a single game. Modelled explicitly so the engine is a
 * predictable state machine rather than a tangle of booleans.
 *
 * - selecting_first  : active player must flip their first card
 * - selecting_second : one card is face-up, waiting for the second flip
 * - resolving         : two cards are face-up; outcome is computed and shown
 *                       briefly before being acknowledged (END_REVEAL)
 * - completed         : game over, see winner fields
 */
export type GamePhase =
  | 'selecting_first'
  | 'selecting_second'
  | 'resolving'
  | 'completed';

export interface ScoreEntry {
  /** Keyed per player; for team modes, team score is the sum of members. */
  playerId: PlayerId;
  teamId: TeamId | null;
  score: number;
  matchedPairs: number;
}

/** Tracks phrase-solve attempts and pending skips per player. */
export interface AttemptState {
  playerId: PlayerId;
  attemptsUsed: number;
  /** Number of upcoming turns this player must skip (penalty). */
  skipTurns: number;
}

export interface Game {
  id: GameId;
  roomId: RoomId;
  mode: GameMode;
  status: GameStatus;
  phase: GamePhase;

  /** Deterministic seed used for any shuffling — enables replay & server auth. */
  seed: number;
  /** Monotonic counter; every applied action increments it. Guards races. */
  version: number;
  /** Monotonic turn index, increments on every turn pass. */
  turnIndex: number;

  currentTurnPlayerId: PlayerId;
  currentTeamId: TeamId | null;
  /** Stable rotation order of players for turn passing. */
  turnOrder: PlayerId[];

  deck: Card[];
  /** Card ids face-up this turn (max 2). Cleared after each resolution. */
  selection: CardId[];

  hiddenPhrase: Phrase;
  /** Word ids already revealed, in reveal order. */
  revealedWords: WordId[];

  scores: ScoreEntry[];
  attempts: AttemptState[];

  winnerId: PlayerId | null;
  winnerTeamId: TeamId | null;

  startedAt: EpochMs;
  endedAt: EpochMs | null;
}
