import type { CardId, EpochMs, GameId, PlayerId, RoomId } from './ids';

/**
 * A move as submitted by a client. The engine never trusts the rest of game
 * state from the client — only the player's intent below — and re-derives all
 * outcomes from the authoritative snapshot.
 */
export interface Move {
  playerId: PlayerId;
  roomId: RoomId;
  gameId: GameId;
  selectedCardId: CardId;
  timestamp: EpochMs;
}

export interface SolveAttempt {
  playerId: PlayerId;
  roomId: RoomId;
  gameId: GameId;
  guess: string;
  timestamp: EpochMs;
}
