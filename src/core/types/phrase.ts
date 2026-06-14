import type { PhraseId } from './ids';

export type PhraseDifficulty = 'easy' | 'medium' | 'hard';

export type PhraseSourceType = 'proverb' | 'trend' | 'meme' | 'custom';

export interface Phrase {
  id: PhraseId;
  category: string;
  fullText: string;
  /** Ordered words. The engine reveals these one at a time as pairs match. */
  words: string[];
  difficulty: PhraseDifficulty;
  sourceType: PhraseSourceType;
}

/** A named, shippable collection of phrases (proverbs, trends, etc.). */
export interface PhrasePack {
  id: string;
  name: string;
  description: string;
  sourceType: PhraseSourceType;
  phrases: Phrase[];
}
