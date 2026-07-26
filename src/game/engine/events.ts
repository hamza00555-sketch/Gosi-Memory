import type { PairId, TargetId, TeamId } from '../../domain/ids';

/**
 * Side-effect requests emitted by the reducer. The engine itself stays pure —
 * it never plays a sound or starts an animation — so these describe what
 * happened and let each device decide how to present it with its own object
 * set, sounds and reduced-motion settings.
 */
export type GameEvent =
  | { type: 'scan_accepted'; teamId: TeamId; targetId: TargetId; slot: 'first' | 'second' }
  | { type: 'match'; teamId: TeamId; pairId: PairId; points: number }
  | { type: 'mismatch'; teamId: TeamId; first: TargetId; second: TargetId }
  | { type: 'turn_expired'; teamId: TeamId }
  | { type: 'turn_started'; teamId: TeamId; playerIndex: number }
  | { type: 'challenge_started'; challengeId: string; advantagedTeamId: TeamId }
  | { type: 'challenge_resolved'; winnerTeamId: TeamId | null; points: number }
  | { type: 'puzzle_piece_revealed'; teamId: TeamId; revealedCount: number }
  | { type: 'puzzle_opened'; teamId: TeamId }
  | { type: 'puzzle_solved'; teamId: TeamId; points: number }
  | { type: 'puzzle_failed'; teamId: TeamId; penalty: number }
  | { type: 'round_exhausted'; roundNumber: number }
  | { type: 'round_started'; roundNumber: number }
  | { type: 'game_completed'; winnerTeamId: TeamId };
