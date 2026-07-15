import type { GameConfig } from '../types/config';
import type { Game } from '../types/game';
import { getDefaultConfig } from './config';
import { initGame } from './engine';

export const TEST_PAIRS = [
  'pair_crab',
  'pair_palm',
  'pair_ball',
  'pair_boat',
  'pair_sun',
  'pair_shell',
] as const;

export function soloConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...getDefaultConfig('solo'), ...overrides };
}

export function passPlayConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...getDefaultConfig('pass_play'), ...overrides };
}

/** Build a deterministic game for tests. */
export function makeGame(
  players: string[] = ['p1', 'p2'],
  config: GameConfig = passPlayConfig(),
  pairIds: readonly string[] = TEST_PAIRS,
): Game {
  return initGame({
    id: 'g1',
    setId: 'test_set',
    config,
    pairIds,
    turnOrder: players,
    startedAt: 1_000,
  });
}

/** Two card ids belonging to the same pair (guaranteed match). */
export function matchingPair(game: Game, skipMatched = false): [string, string] {
  const byPair = new Map<string, string[]>();
  for (const c of game.deck) {
    if (skipMatched && c.isMatched) continue;
    const list = byPair.get(c.pairId) ?? [];
    list.push(c.id);
    byPair.set(c.pairId, list);
  }
  for (const ids of byPair.values()) {
    if (ids.length >= 2) return [ids[0]!, ids[1]!];
  }
  throw new Error('no matching pair found');
}

/** Two card ids from different pairs (guaranteed mismatch). */
export function mismatchedPair(game: Game): [string, string] {
  const first = game.deck.find((c) => !c.isMatched)!;
  const other = game.deck.find((c) => !c.isMatched && c.pairId !== first.pairId)!;
  return [first.id, other.id];
}
