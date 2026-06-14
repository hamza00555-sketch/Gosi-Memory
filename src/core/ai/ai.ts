import { reduce } from '../engine/engine';
import type { GameConfig } from '../types/config';
import type { Card } from '../types/card';
import type { Game } from '../types/game';
import type { CardId, PairId } from '../types/ids';
import type { Rng } from '../utils/rng';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

/** Probability the AI commits a revealed card to memory (its "skill"). */
const RETENTION: Record<AiDifficulty, number> = {
  easy: 0.2,
  medium: 0.6,
  hard: 0.95,
};

/** What the AI remembers: cardId -> pairId for cards it has seen face-up. */
export type AiMemory = Map<CardId, PairId>;

export function createAiMemory(): AiMemory {
  return new Map();
}

/**
 * Record a card the AI just saw revealed. Higher difficulty retains more.
 * Matched cards are always remembered (they are public board state).
 */
export function observeCard(
  memory: AiMemory,
  card: Card,
  difficulty: AiDifficulty,
  rng: Rng,
): void {
  if (card.isMatched || rng.next() < RETENTION[difficulty]) {
    memory.set(card.id, card.pairId);
  }
}

/** Refresh memory from every currently face-up card on the board. */
export function observeBoard(
  memory: AiMemory,
  game: Game,
  difficulty: AiDifficulty,
  rng: Rng,
): void {
  for (const card of game.deck) {
    if (card.isRevealed || card.isMatched) observeCard(memory, card, difficulty, rng);
  }
}

interface CardChoice {
  first: CardId;
  second: CardId;
}

/**
 * Decide which two cards to flip this turn. Uses memory to complete a known
 * pair when possible; otherwise explores. Never references unseen cards' pairs.
 */
export function chooseCards(
  game: Game,
  memory: AiMemory,
  rng: Rng,
): CardChoice | null {
  const candidates = game.deck.filter((c) => !c.isMatched);
  if (candidates.length < 2) return null;

  const remembered = candidates.filter((c) => memory.has(c.id));

  // 1) If two remembered cards form a pair, take the guaranteed match.
  for (let i = 0; i < remembered.length; i++) {
    for (let j = i + 1; j < remembered.length; j++) {
      const a = remembered[i]!;
      const b = remembered[j]!;
      if (a.pairId === b.pairId) return { first: a.id, second: b.id };
    }
  }

  // 2) Flip a (preferably unseen) first card to gain information.
  const unseen = candidates.filter((c) => !memory.has(c.id));
  const firstPool = unseen.length > 0 ? unseen : candidates;
  const first = firstPool[rng.int(firstPool.length)]!;

  // 3) The AI now "sees" first's pair; complete it from memory if known.
  const knownMate = remembered.find(
    (c) => c.id !== first.id && c.pairId === first.pairId,
  );
  if (knownMate) return { first: first.id, second: knownMate.id };

  // 4) Otherwise pick another distinct card (prefer unseen).
  const secondPool = (unseen.length > 1 ? unseen : candidates).filter(
    (c) => c.id !== first.id,
  );
  const second = secondPool[rng.int(secondPool.length)]!;
  return { first: first.id, second: second.id };
}

/**
 * Play one complete AI turn headlessly against the engine. Returns the final
 * game state after the turn ends (either by passing or by continuing matches).
 * Used by tests and the offline runner; the UI uses chooseCards with timers.
 */
export function playAiTurn(
  game: Game,
  config: GameConfig,
  memory: AiMemory,
  difficulty: AiDifficulty,
  rng: Rng,
  now: () => number = () => Date.now(),
): Game {
  let state = game;
  const aiId = state.currentTurnPlayerId;
  let safety = 0;

  while (
    state.status === 'in_progress' &&
    state.currentTurnPlayerId === aiId &&
    safety++ < 100
  ) {
    observeBoard(memory, state, difficulty, rng);
    const choice = chooseCards(state, memory, rng);
    if (!choice) break;

    const steps = [
      { type: 'SELECT_CARD' as const, playerId: aiId, cardId: choice.first },
      { type: 'SELECT_CARD' as const, playerId: aiId, cardId: choice.second },
      { type: 'END_REVEAL' as const, playerId: aiId },
    ];

    for (const action of steps) {
      const result = reduce(state, action, config, now());
      if (!result.ok) return state; // illegal — stop defensively
      state = result.value.game;
      observeBoard(memory, state, difficulty, rng);
    }
  }

  return state;
}
