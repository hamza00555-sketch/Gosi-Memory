import type { PairId, TargetId } from './ids';

/**
 * A physical printed card.
 *
 * Card identity (this file) is deliberately separate from:
 *  - how it is RECOGNIZED   → targetIndex in the compiled .mind file
 *  - what is DRAWN over it  → the object set chosen on each device
 *
 * The two cards of a pair are visually DIFFERENT images that share one pairId
 * (e.g. a character and its tool). That is what makes scanning the same card
 * twice impossible to mistake for a match.
 */
export interface CardDefinition {
  targetId: TargetId;
  pairId: PairId;
  /** 'a' or 'b' — which half of the pair this card is. */
  side: 'a' | 'b';
  /** Arabic display name, shown in the scan slots. */
  name: string;
  /** Short Arabic description used by the help sheet. */
  description: string;
}

/** One row of targets-manifest.json — the recognition-side record. */
export interface TargetManifestEntry {
  /** Position of this image inside the compiled .mind file. Must be exact. */
  targetIndex: number;
  targetId: TargetId;
  pairId: PairId;
  /** Source image the .mind entry was compiled from (documentation + recompile). */
  targetImage: string;
}

/** A pair of cards, as authored in pairs.json. */
export interface PairDefinition {
  pairId: PairId;
  /** Arabic name of the pair concept, e.g. "الطاهي وسكينه". */
  name: string;
  targetIds: [TargetId, TargetId];
}

/** Runtime per-card state derived from the canonical game state. */
export interface CardRuntimeState {
  targetId: TargetId;
  pairId: PairId;
  /** True once this card's pair has been matched. */
  matched: boolean;
  /**
   * True when this card may not be registered as a selection right now —
   * because it is matched, already the first pick, or it is not our turn.
   * Locked cards still render their AR object; they just cannot be chosen.
   */
  locked: boolean;
}
