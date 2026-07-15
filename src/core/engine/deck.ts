import { cardIdOf, type Card, type CardSide } from '../types/card';
import type { PairId } from '../types/ids';

const SIDES: CardSide[] = ['a', 'b'];

/**
 * Build the engine's bookkeeping deck for a printed set: two cards per pair.
 *
 * Unlike a digital memory game there is NO shuffle here — the physical cards
 * are shuffled by hand on the table. The engine only needs a stable record of
 * which cards exist and their revealed/matched state.
 */
export function generateDeck(pairIds: readonly PairId[]): Card[] {
  return pairIds.flatMap((pairId) =>
    SIDES.map((side) => ({
      id: cardIdOf(pairId, side),
      pairId,
      side,
      isRevealed: false,
      isMatched: false,
    })),
  );
}
