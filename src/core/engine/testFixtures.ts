import type { GameConfig } from '../types/config';
import type { Game } from '../types/game';
import type { Phrase } from '../types/phrase';
import { getDefaultConfig } from './config';
import { initGame } from './engine';

export const TEST_PHRASE: Phrase = {
  id: 'test_phrase',
  category: 'اختبار',
  fullText: 'ما خاب من استشار',
  words: ['ما', 'خاب', 'من', 'استشار'],
  difficulty: 'easy',
  sourceType: 'proverb',
};

export function soloConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...getDefaultConfig('solo_ai'), pairCount: 6, ...overrides };
}

/** Build a deterministic two-player game for tests. */
export function makeGame(
  players: string[] = ['p1', 'p2'],
  config: GameConfig = soloConfig(),
  seed = 12345,
): Game {
  return initGame({
    id: 'g1',
    roomId: 'r1',
    mode: config.mode,
    config,
    phrase: TEST_PHRASE,
    turnOrder: players,
    backSkinId: 'skin_default',
    seed,
    startedAt: 1_000,
  });
}

/** Two card ids belonging to the same pair (guaranteed match). */
export function matchingPair(game: Game): [string, string] {
  const byPair = new Map<string, string[]>();
  for (const c of game.deck) {
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
  const first = game.deck[0]!;
  const other = game.deck.find((c) => c.pairId !== first.pairId)!;
  return [first.id, other.id];
}

/** A pair that maps to a phrase word (revealedWordId set). */
export function wordPair(game: Game): [string, string] {
  const card = game.deck.find((c) => c.revealedWordId)!;
  const mate = game.deck.find((c) => c.pairId === card.pairId && c.id !== card.id)!;
  return [card.id, mate.id];
}
