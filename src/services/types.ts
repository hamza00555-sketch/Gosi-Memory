import type { Result } from '../core/engine/errors';
import type { Game } from '../core/types/game';
import type { Room, GameMode } from '../core/types/room';
import type { AiDifficulty } from '../core/ai/ai';

/**
 * The boundary between UI and the world. Components depend ONLY on this
 * interface — never on Supabase directly — so we can run fully offline today
 * (LocalGameService) and swap in realtime (SupabaseGameService) with no UI
 * changes. All write methods return a Result so failures are explicit.
 */

export interface PlayerIdentity {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CreateRoomInput {
  mode: GameMode;
  host: PlayerIdentity;
  /** Only meaningful for solo_ai. */
  difficulty?: AiDifficulty;
}

export interface JoinRoomInput {
  code: string;
  player: PlayerIdentity;
}

export interface RoomRef {
  roomId: string;
  playerId: string;
}

export interface MoveInput {
  roomId: string;
  gameId: string;
  playerId: string;
  cardId: string;
}

export interface RevealAckInput {
  roomId: string;
  gameId: string;
  playerId: string;
}

export interface SolveInput {
  roomId: string;
  gameId: string;
  playerId: string;
  guess: string;
}

export type Unsubscribe = () => void;

export interface GameService {
  // --- Room lifecycle -------------------------------------------------------
  createRoom(input: CreateRoomInput): Promise<Result<Room>>;
  joinRoom(input: JoinRoomInput): Promise<Result<Room>>;
  leaveRoom(ref: RoomRef): Promise<Result<void>>;
  setReady(ref: RoomRef & { isReady: boolean }): Promise<Result<Room>>;
  startGame(ref: RoomRef): Promise<Result<Game>>;

  // --- In-game actions ------------------------------------------------------
  submitMove(input: MoveInput): Promise<Result<Game>>;
  /** Acknowledge the brief reveal of two flipped cards; advances the turn. */
  acknowledgeReveal(input: RevealAckInput): Promise<Result<Game>>;
  attemptSolvePhrase(input: SolveInput): Promise<Result<Game>>;
  /** Report that the turn timer expired (also enforced authoritatively). */
  reportTimeout(input: RevealAckInput): Promise<Result<Game>>;

  // --- Realtime + reconnection ---------------------------------------------
  subscribeToRoom(roomId: string, cb: (room: Room) => void): Unsubscribe;
  subscribeToGame(gameId: string, cb: (game: Game) => void): Unsubscribe;
  /** Re-fetch the latest room + game after a refresh/disconnect. */
  reconnectToRoom(ref: RoomRef): Promise<Result<{ room: Room; game: Game | null }>>;
}
