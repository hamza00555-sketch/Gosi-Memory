import type { AssetId, CardId, CosmeticId, PairId, WordId } from './ids';

export interface Card {
  id: CardId;
  /** Cards sharing a pairId are a match. */
  pairId: PairId;
  /** Visual on the card face (icon/illustration asset). */
  faceAssetId: AssetId;
  /** Cosmetic card-back skin currently applied. */
  backSkinId: CosmeticId;
  /**
   * The phrase word this pair reveals when matched, or null if this pair
   * does not map to a word (decoy pairs when there are more pairs than words).
   */
  revealedWordId: WordId | null;
  isRevealed: boolean;
  isMatched: boolean;
  /** Grid slot index (0-based), stable for the whole game. */
  position: number;
}
