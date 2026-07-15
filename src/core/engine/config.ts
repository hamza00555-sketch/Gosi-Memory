import type { GameConfig, GameMode } from '../types/config';

/**
 * Default rule sets per mode. These are the single source of truth for game
 * tuning — components read these, never inline their own numbers.
 */
export const DEFAULT_CONFIGS: Record<GameMode, GameConfig> = {
  solo: {
    mode: 'solo',
    matchScore: 100,
    turnAfterMatch: 'continue',
    mismatchRevealMs: 2200,
    matchRevealMs: 1600,
  },
  pass_play: {
    mode: 'pass_play',
    matchScore: 100,
    turnAfterMatch: 'continue',
    mismatchRevealMs: 2600,
    matchRevealMs: 1600,
  },
};

export function getDefaultConfig(mode: GameMode): GameConfig {
  return { ...DEFAULT_CONFIGS[mode] };
}
