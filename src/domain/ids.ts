/**
 * Nominal-ish id aliases. Plain strings at runtime (RTDB-safe), but they make
 * function signatures self-documenting and catch argument-order mistakes when
 * read by a human.
 */
export type RoomId = string;
export type RoomCode = string;
export type DeviceUid = string;

/** 'teamA' | 'teamB' — the only two teams that ever exist. */
export type TeamId = 'teamA' | 'teamB';

/** Identifies one physical printed card, e.g. 'card_01_a'. */
export type TargetId = string;
/** Links the two cards that form a pair, e.g. 'pair_01'. */
export type PairId = string;
/** An object-set id, e.g. 'default_set'. */
export type ObjectSetId = string;
export type ChallengeId = string;
export type PuzzleId = string;
export type SoundId = string;

/** Milliseconds since epoch — always Firebase server time on canonical state. */
export type EpochMs = number;

export const TEAM_IDS: readonly TeamId[] = ['teamA', 'teamB'] as const;

export function otherTeam(teamId: TeamId): TeamId {
  return teamId === 'teamA' ? 'teamB' : 'teamA';
}
