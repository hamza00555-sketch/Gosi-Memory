import type { Card } from '../types/card';
import type { Game } from '../types/game';
import type { CardId, PlayerId } from '../types/ids';

/** Pure read helpers over Game. UI and engine share these — no duplicated math. */

export function findCard(game: Game, cardId: CardId): Card | undefined {
  return game.deck.find((c) => c.id === cardId);
}

export function allMatched(game: Game): boolean {
  return game.deck.every((c) => c.isMatched);
}

export function playerScore(game: Game, playerId: PlayerId): number {
  return game.scores.find((s) => s.playerId === playerId)?.score ?? 0;
}

export function matchedPairCount(game: Game): number {
  return game.deck.filter((c) => c.isMatched).length / 2;
}

export function totalPairCount(game: Game): number {
  return game.deck.length / 2;
}

export function remainingPairCount(game: Game): number {
  return totalPairCount(game) - matchedPairCount(game);
}

/** Duration of the match so far (or final duration once ended). */
export function elapsedMs(game: Game, now: number): number {
  return (game.endedAt ?? now) - game.startedAt;
}
