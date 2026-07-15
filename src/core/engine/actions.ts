import type { CardId, PairId, PlayerId } from '../types/ids';

/**
 * The complete set of actions the engine understands. Anything that mutates a
 * Game goes through one of these — there is no other way to change state.
 *
 * Note there is no playerId on SELECT_CARD: with physical cards the flip is
 * always attributed to the current-turn player (the phone is the referee, and
 * whoever's turn it is holds the table).
 */
export type GameAction =
  | { type: 'SELECT_CARD'; cardId: CardId }
  /** Acknowledge the briefly-shown resolution and apply its consequences. */
  | { type: 'END_REVEAL' };

/**
 * Side-effect-free description of what happened, returned alongside the new
 * state. The UI turns these into toasts, sounds, and AR effects; it does not
 * re-derive game meaning from raw state diffs.
 */
export type GameEvent =
  | { type: 'CARD_REVEALED'; cardId: CardId }
  | { type: 'PAIR_MATCHED'; cardIds: [CardId, CardId]; pairId: PairId; by: PlayerId; points: number }
  | { type: 'PAIR_MISSED'; cardIds: [CardId, CardId]; by: PlayerId }
  | { type: 'TURN_PASSED'; from: PlayerId; to: PlayerId }
  | { type: 'GAME_COMPLETED'; winnerId: PlayerId | null };
