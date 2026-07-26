import type { ChallengeId, EpochMs, TeamId } from './ids';

export type ChallengeType =
  | 'reaction_rush'
  | 'sequence_memory'
  | 'visual_puzzle'
  | 'team_sync';

/**
 * How the matching team is rewarded for having earned the challenge. Chosen per
 * challenge in content so different mini-games can favour the winner
 * differently without special-casing code.
 */
export type ChallengeAdvantage = 'head_start' | 'extra_attempt' | 'score_bonus';

/** Authored form, in challenges.json. */
export interface ChallengeDefinition {
  id: ChallengeId;
  type: ChallengeType;
  durationMs: number;
  prompt: string;
  /** Answer options for option-based challenges; empty otherwise. */
  options: string[];
  /** Index into `options`, or -1 when the type computes correctness itself. */
  correctAnswer: number;
  /** Image/sound paths referenced by the renderer. */
  assets: string[];
  matchTeamAdvantage: ChallengeAdvantage;
  scoreReward: number;
}

/**
 * The resolved, per-instance data both devices must render identically. Derived
 * from the definition plus the match seed by the host, then broadcast — never
 * recomputed locally, so the two screens can never disagree.
 */
export type ChallengePayload =
  | { kind: 'reaction_rush'; revealAt: EpochMs }
  /**
   * `sequence` is the prompt to memorize. `palette` is the button row the team
   * taps to reproduce it; a submission is a list of palette indices, so the
   * host can score it without trusting any text from the device.
   */
  | { kind: 'sequence_memory'; sequence: string[]; palette: string[]; hideAtMs: number }
  | { kind: 'visual_puzzle'; options: string[]; correctAnswer: number; image: string | null }
  | { kind: 'team_sync'; zones: number };

export interface ChallengeSubmission {
  teamId: TeamId;
  /** Interpretation depends on the challenge type; -1 means "fouled". */
  answer: number;
  /** Ordered answer for sequence_memory; empty otherwise. */
  sequence: number[];
  submittedAt: EpochMs;
  correct: boolean;
  /** How many tries this team has spent — caps the 'extra_attempt' advantage. */
  attempts: number;
}

export interface ChallengeState {
  challengeId: ChallengeId;
  type: ChallengeType;
  prompt: string;
  /** Server time the challenge becomes interactive (after the intro beat). */
  startsAt: EpochMs;
  endsAt: EpochMs;
  /** Team that earned the challenge by matching; receives the advantage. */
  advantagedTeamId: TeamId;
  advantage: ChallengeAdvantage;
  /** Milliseconds of head start granted when advantage === 'head_start'. */
  headStartMs: number;
  scoreReward: number;
  payload: ChallengePayload;
  submissions: Partial<Record<TeamId, ChallengeSubmission>>;
  winnerTeamId: TeamId | null;
  /** Set once the award has been applied, so a winner is never paid twice. */
  resolved: boolean;
}

/** When a given team may begin interacting, accounting for the head start. */
export function interactiveAtFor(challenge: ChallengeState, teamId: TeamId): EpochMs {
  if (challenge.advantage !== 'head_start') return challenge.startsAt;
  return teamId === challenge.advantagedTeamId
    ? challenge.startsAt
    : challenge.startsAt + challenge.headStartMs;
}
