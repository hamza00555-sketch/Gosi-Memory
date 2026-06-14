import type { GameMode } from './room';
import type { PhraseDifficulty } from './phrase';

/** What happens to the turn after a successful match. */
export type TurnAfterMatch = 'continue' | 'pass';

/** Penalty applied when a phrase solve attempt is wrong. */
export type WrongSolvePenalty = 'skip_next_turn' | 'reduce_score' | 'consume_attempt';

/**
 * All tunable game rules live here so no rule is hard-coded inside the engine
 * or duplicated across components. A GameConfig is captured at game start.
 */
export interface GameConfig {
  mode: GameMode;
  /** Number of matching pairs in the deck. Deck size = pairCount * 2. */
  pairCount: number;
  /** Points awarded per successful match. */
  matchScore: number;
  /** Points awarded for solving the phrase (added to the winner's score). */
  solveBonus: number;
  /** Whether the active player keeps the turn after a match. */
  turnAfterMatch: TurnAfterMatch;
  /** How wrong phrase guesses are punished. */
  wrongSolvePenalty: WrongSolvePenalty;
  /** Points removed when penalty is 'reduce_score'. */
  wrongSolveScorePenalty: number;
  /** Max solve attempts per player (used by 'consume_attempt'). */
  maxSolveAttempts: number;
  /** Per-turn timer in ms (0 disables the timer). UI + server enforce it. */
  turnTimerMs: number;
  /** How long mismatched cards stay visible before hiding (UI timing, ms). */
  mismatchRevealMs: number;
  /** Difficulty band used when auto-selecting a phrase. */
  phraseDifficulty: PhraseDifficulty;
}
