import type { Phrase, PhraseDifficulty, PhrasePack } from '../types/phrase';
import { createRng } from '../utils/rng';
import proverbs from '../../content/phrases/proverbs.json';
import trends from '../../content/phrases/trends.json';
import social from '../../content/phrases/social.json';
import custom from '../../content/phrases/custom.json';

/**
 * Content is loaded from JSON seed files, never inlined in components. To add a
 * pack: drop a JSON file under src/content/phrases and register it here.
 */
const PACKS: PhrasePack[] = [
  proverbs as PhrasePack,
  trends as PhrasePack,
  social as PhrasePack,
  custom as PhrasePack,
];

export function getAllPacks(): PhrasePack[] {
  return PACKS;
}

export function getAllPhrases(): Phrase[] {
  return PACKS.flatMap((p) => p.phrases);
}

export function getPhraseById(id: string): Phrase | undefined {
  return getAllPhrases().find((p) => p.id === id);
}

export function getPhrasesByDifficulty(difficulty: PhraseDifficulty): Phrase[] {
  return getAllPhrases().filter((p) => p.difficulty === difficulty);
}

/**
 * Deterministically pick a phrase for a game. Using the game seed keeps client
 * and server in agreement about which phrase a match uses.
 */
export function pickPhrase(difficulty: PhraseDifficulty, seed: number): Phrase {
  const pool = getPhrasesByDifficulty(difficulty);
  const candidates = pool.length > 0 ? pool : getAllPhrases();
  const rng = createRng(seed);
  return candidates[rng.int(candidates.length)]!;
}
