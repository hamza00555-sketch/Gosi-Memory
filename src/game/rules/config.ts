/**
 * Every tunable rule in one place. Nothing here is duplicated in a component —
 * balancing the game means editing this file only.
 */
export const RULES = {
  /** Base turn length. Spec: 20 seconds. */
  turnDurationMs: 20_000,

  /** Pre-round synchronized countdown. */
  countdownMs: 3_000,

  /** How long the match/mismatch beat holds before the next phase. */
  resolveDisplayMs: 2_200,

  /** Quiet beat after the challenge intro before it becomes interactive. */
  challengeIntroMs: 1_200,

  /** Head start granted to the matching team when advantage is 'head_start'. */
  challengeHeadStartMs: 1_000,

  /** Bonus applied when the matching team's advantage is 'score_bonus'. */
  challengeScoreBonus: 15,

  /**
   * Server-side confidence floor. The AR scan gate filters far more
   * aggressively; this is the last line of defence against a forged command.
   */
  minScanConfidence: 0.6,

  /** Ignore a command that took longer than this to arrive — it is stale. */
  maxCommandAgeMs: 15_000,

  /** Clock skew tolerance when validating turn expiry against server time. */
  clockSkewToleranceMs: 1_500,

  /** sequence_memory: how many symbols, and how long they stay visible. */
  sequenceMinLength: 4,
  sequenceMaxLength: 6,
  sequenceShowMs: 2_600,
} as const;

export type Rules = typeof RULES;
