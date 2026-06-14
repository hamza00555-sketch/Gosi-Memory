import type { CardId, PlayerId, WordId } from '../types/ids';

/**
 * The complete set of actions the engine understands. Anything that mutates a
 * Game goes through one of these — there is no other way to change state.
 */
export type GameAction =
  | { type: 'SELECT_CARD'; playerId: PlayerId; cardId: CardId }
  /** Acknowledge the briefly-shown resolution and apply its consequences. */
  | { type: 'END_REVEAL'; playerId: PlayerId }
  | { type: 'SOLVE_PHRASE'; playerId: PlayerId; guess: string }
  /** Turn timer expired; forfeits the current player's turn. */
  | { type: 'TIMEOUT'; playerId: PlayerId };

/**
 * Side-effect-free description of what happened, returned alongside the new
 * state. The UI turns these into toasts, sounds, and animations; it does not
 * re-derive game meaning from raw state diffs.
 */
export type GameEvent =
  | { type: 'CARD_REVEALED'; cardId: CardId }
  | { type: 'PAIR_MATCHED'; cardIds: [CardId, CardId]; by: PlayerId; points: number }
  | { type: 'PAIR_MISSED'; cardIds: [CardId, CardId]; by: PlayerId }
  | { type: 'WORD_REVEALED'; wordId: WordId }
  | { type: 'TURN_PASSED'; from: PlayerId; to: PlayerId }
  | { type: 'PHRASE_SOLVED'; by: PlayerId }
  | { type: 'SOLVE_FAILED'; by: PlayerId; penalty: string }
  | { type: 'GAME_COMPLETED'; winnerId: PlayerId | null };
