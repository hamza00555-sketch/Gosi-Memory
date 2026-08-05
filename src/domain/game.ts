import type { ChallengeState } from './challenge';
import type { EpochMs, PairId, RoomCode, RoomId, TargetId, TeamId } from './ids';
import type { TeamPuzzleState } from './puzzle';
import type { Team } from './teams';

/**
 * Where the match is in its lifecycle. Every device renders from this, and the
 * engine refuses commands that do not belong to the current phase — that is
 * what makes an illegal move unrepresentable rather than merely discouraged.
 */
export type GamePhase =
  | 'countdown'
  | 'scanning_first'
  | 'scanning_second'
  | 'resolving'
  | 'challenge'
  | 'puzzle'
  | 'round_reset'
  | 'completed';

export type RoomStatus = 'lobby' | 'in_progress' | 'completed';

export const TARGET_SCORE_OPTIONS = [500, 600, 800] as const;
export type TargetScore = (typeof TARGET_SCORE_OPTIONS)[number];

export const MATCH_SCORE = 100;
export const CHALLENGE_SCORE = 50;

/** Outcome of the turn that just resolved — drives the match/mismatch screen. */
export interface TurnOutcome {
  kind: 'match' | 'mismatch';
  teamId: TeamId;
  firstTargetId: TargetId;
  secondTargetId: TargetId;
  pairId: PairId | null;
  at: EpochMs;
}

/**
 * The canonical match state. This is the exact shape persisted at
 * rooms/{roomId}/game — JSON-only, no undefined, no Date, no Set. Collections
 * that behave like sets are Records because Realtime Database stores sparse
 * arrays as objects and would corrupt index-based lists on partial updates.
 */
export interface GameState {
  phase: GamePhase;
  roundNumber: number;
  activeTeamId: TeamId;
  turnStartedAt: EpochMs;
  turnEndsAt: EpochMs;
  firstTargetId: TargetId | null;
  secondTargetId: TargetId | null;
  /** Set of matched pairs. Record, not array — see note above. */
  matchedPairIds: Record<PairId, true>;
  scores: Record<TeamId, number>;
  targetScore: number;
  /** Seeds every deterministic choice: puzzle order, challenge payloads. */
  seed: number;
  /** Incremented on every accepted command; rejects stale writers. */
  version: number;
  lastOutcome: TurnOutcome | null;
  winnerTeamId: TeamId | null;
  /** Server time the pre-round countdown ends. Null outside 'countdown'. */
  countdownEndsAt: EpochMs | null;
  /** Teams that confirmed they reshuffled the physical cards. */
  roundReadyTeams: Record<string, true>;
  /** The team currently allowed to answer their puzzle. Null outside 'puzzle'. */
  puzzleTeamId: TeamId | null;
}

export interface RoomConfig {
  targetScore: number;
  turnDurationMs: number;
  /** Content pack driving cards, challenges and puzzles. */
  packId: string;
  /**
   * How many pairs this match must find before the table is exhausted.
   *
   * Pinned when the room is created rather than read from content at decision
   * time: only pairs whose images are in the compiled target library can be
   * scanned, and recompiling the library mid-match must not silently move the
   * finish line.
   */
  pairCount: number;
}

/** Everything under rooms/{roomId}. */
export interface RoomState {
  id: RoomId;
  code: RoomCode;
  hostUid: string;
  status: RoomStatus;
  createdAt: EpochMs;
  config: RoomConfig;
  teams: Record<TeamId, Team>;
  game: GameState;
  challenge: ChallengeState | null;
  puzzles: Record<TeamId, TeamPuzzleState>;
}

export function isPairMatched(game: GameState, pairId: PairId): boolean {
  return game.matchedPairIds[pairId] === true;
}

export function matchedPairCount(game: GameState): number {
  return Object.keys(game.matchedPairIds).length;
}

/** Phases in which a scan may be registered as a selection. */
export function isScanPhase(phase: GamePhase): phase is 'scanning_first' | 'scanning_second' {
  return phase === 'scanning_first' || phase === 'scanning_second';
}
