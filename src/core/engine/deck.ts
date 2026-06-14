import type { Card } from '../types/card';
import type { CosmeticId } from '../types/ids';
import type { Phrase } from '../types/phrase';
import { createRng, shuffle, type Rng } from '../utils/rng';

/**
 * Face asset pool. Replaceable placeholders kept in one organized list rather
 * than scattered magic strings. Swap ids for real art / AR objects later.
 */
export const FACE_ASSETS: string[] = [
  'face_key',
  'face_heart',
  'face_coffee',
  'face_star',
  'face_bolt',
  'face_moon',
  'face_gear',
  'face_crown',
  'face_leaf',
  'face_flame',
  'face_gem',
  'face_anchor',
];

export interface DeckOptions {
  phrase: Phrase;
  pairCount: number;
  backSkinId: CosmeticId;
  seed: number;
}

/**
 * Build a shuffled deck of `pairCount * 2` cards.
 *
 * Each pair maps to one phrase word (by index). If there are more pairs than
 * words, the extra pairs are "decoys" with revealedWordId = null — they still
 * score but reveal nothing. Positions are assigned after shuffling so the grid
 * layout is randomized but stable for the whole game.
 */
export function generateDeck(options: DeckOptions): Card[] {
  const { phrase, pairCount, backSkinId, seed } = options;
  const rng: Rng = createRng(seed);

  const wordCount = phrase.words.length;
  const cards: Card[] = [];

  for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
    const pairId = `pair_${pairIndex}`;
    const faceAssetId = FACE_ASSETS[pairIndex % FACE_ASSETS.length]!;
    // Map the first `wordCount` pairs to words; the rest are decoys.
    const revealedWordId = pairIndex < wordCount ? `${phrase.id}:w${pairIndex}` : null;

    for (let copy = 0; copy < 2; copy++) {
      cards.push({
        id: `${pairId}_${copy}`,
        pairId,
        faceAssetId,
        backSkinId,
        revealedWordId,
        isRevealed: false,
        isMatched: false,
        position: -1, // assigned below
      });
    }
  }

  const shuffled = shuffle(cards, rng);
  return shuffled.map((card, index) => ({ ...card, position: index }));
}

/** Resolve a wordId back to its index/text for reveal logic. */
export function wordIndexFromId(phrase: Phrase, wordId: string): number {
  const prefix = `${phrase.id}:w`;
  if (!wordId.startsWith(prefix)) return -1;
  const idx = Number.parseInt(wordId.slice(prefix.length), 10);
  return Number.isInteger(idx) ? idx : -1;
}
