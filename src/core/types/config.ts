/**
 * How a match is played on the table.
 * - solo      : one player, scored by moves + time
 * - pass_play : 2..4 players taking turns on one device
 */
export type GameMode = 'solo' | 'pass_play';

/** What happens to the turn after a successful match. */
export type TurnAfterMatch = 'continue' | 'pass';

/**
 * All tunable game rules live here so no rule is hard-coded inside the engine
 * or duplicated across components. A GameConfig is captured at game start.
 */
export interface GameConfig {
  mode: GameMode;
  /** Points awarded per successful match. */
  matchScore: number;
  /** Whether the active player keeps the turn after a match. */
  turnAfterMatch: TurnAfterMatch;
  /** How long mismatched cards stay "revealed" before END_REVEAL (UI timing, ms). */
  mismatchRevealMs: number;
  /** How long the match celebration plays before END_REVEAL (UI timing, ms). */
  matchRevealMs: number;
}
