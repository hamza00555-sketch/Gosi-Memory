import type { Card } from '../types/card';
import type { Game } from '../types/game';
import type { CardId, PlayerId, TeamId } from '../types/ids';

/** Pure read helpers over Game. UI and engine share these — no duplicated math. */

export function findCard(game: Game, cardId: CardId): Card | undefined {
  return game.deck.find((c) => c.id === cardId);
}

export function teamOf(game: Game, playerId: PlayerId): TeamId | null {
  return game.scores.find((s) => s.playerId === playerId)?.teamId ?? null;
}

export function isPlayersTurn(game: Game, playerId: PlayerId): boolean {
  return game.status === 'in_progress' && game.currentTurnPlayerId === playerId;
}

export function allMatched(game: Game): boolean {
  return game.deck.every((c) => c.isMatched);
}

export function playerScore(game: Game, playerId: PlayerId): number {
  return game.scores.find((s) => s.playerId === playerId)?.score ?? 0;
}

export function teamScore(game: Game, teamId: TeamId): number {
  return game.scores
    .filter((s) => s.teamId === teamId)
    .reduce((sum, s) => sum + s.score, 0);
}

/** Distinct team ids present in the game (in stable first-seen order). */
export function teamIds(game: Game): TeamId[] {
  const seen: TeamId[] = [];
  for (const s of game.scores) {
    if (s.teamId && !seen.includes(s.teamId)) seen.push(s.teamId);
  }
  return seen;
}

export function revealedWordCount(game: Game): number {
  return game.revealedWords.length;
}

/** How many phrase words are still hidden. */
export function remainingWords(game: Game): number {
  return Math.max(0, game.hiddenPhrase.words.length - game.revealedWords.length);
}
