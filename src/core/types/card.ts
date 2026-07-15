import type { CardId, PairId } from './ids';

/**
 * Which physical copy of a pair a card is. Printed on the card's QR payload
 * (`…:<pairId>:a` / `…:<pairId>:b`) so the engine can tell the two identical
 * faces apart.
 */
export type CardSide = 'a' | 'b';

/**
 * The engine's bookkeeping for one PHYSICAL printed card. There is no digital
 * grid: position/shuffle live on the table, in the real world. The engine only
 * tracks identity + revealed/matched state.
 */
export interface Card {
  /** Always `${pairId}:${side}` — derivable from any scan. */
  id: CardId;
  /** Cards sharing a pairId are a match. */
  pairId: PairId;
  side: CardSide;
  isRevealed: boolean;
  isMatched: boolean;
}

export function cardIdOf(pairId: PairId, side: CardSide): CardId {
  return `${pairId}:${side}`;
}
