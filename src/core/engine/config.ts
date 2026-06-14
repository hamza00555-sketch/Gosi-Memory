import type { GameConfig } from '../types/config';
import type { GameMode } from '../types/room';

/**
 * Default rule sets per mode. These are the single source of truth for game
 * tuning — components and services read these, never inline their own numbers.
 */
export const DEFAULT_CONFIGS: Record<GameMode, GameConfig> = {
  solo_ai: {
    mode: 'solo_ai',
    pairCount: 6,
    matchScore: 100,
    solveBonus: 250,
    turnAfterMatch: 'continue',
    wrongSolvePenalty: 'skip_next_turn',
    wrongSolveScorePenalty: 50,
    maxSolveAttempts: 3,
    turnTimerMs: 0,
    mismatchRevealMs: 900,
    phraseDifficulty: 'easy',
  },
  one_vs_one: {
    mode: 'one_vs_one',
    pairCount: 8,
    matchScore: 100,
    solveBonus: 300,
    turnAfterMatch: 'continue',
    wrongSolvePenalty: 'skip_next_turn',
    wrongSolveScorePenalty: 75,
    maxSolveAttempts: 3,
    turnTimerMs: 20000,
    mismatchRevealMs: 900,
    phraseDifficulty: 'medium',
  },
  two_vs_two: {
    mode: 'two_vs_two',
    pairCount: 10,
    matchScore: 100,
    solveBonus: 300,
    turnAfterMatch: 'continue',
    wrongSolvePenalty: 'skip_next_turn',
    wrongSolveScorePenalty: 75,
    maxSolveAttempts: 2,
    turnTimerMs: 25000,
    mismatchRevealMs: 900,
    phraseDifficulty: 'hard',
  },
};

export function getDefaultConfig(mode: GameMode): GameConfig {
  return { ...DEFAULT_CONFIGS[mode] };
}
