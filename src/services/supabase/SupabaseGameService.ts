import type { SupabaseClient } from '@supabase/supabase-js';
import { err, moveError, ok, type Result } from '../../core/engine/errors';
import type { Game } from '../../core/types/game';
import type { Room } from '../../core/types/room';
import type {
  CreateRoomInput,
  GameService,
  JoinRoomInput,
  MoveInput,
  RevealAckInput,
  RoomRef,
  SolveInput,
  Unsubscribe,
} from '../types';

/**
 * Realtime adapter backed by Supabase.
 *
 * DESIGN — why it is shaped this way:
 * - All writes go through Postgres RPC functions (create_room, submit_move,
 *   ...). The authoritative engine runs INSIDE those functions, in a single
 *   transaction per call. The client is never trusted to compute outcomes — it
 *   only sends intent (which card, which guess). This is the safest option:
 *   one writer, atomic, with row-level locks preventing two simultaneous moves
 *   from corrupting state. See supabase/ for SQL + RLS.
 * - Reads/subscriptions use Realtime postgres_changes on the rooms/games rows.
 * - Reconnection just re-selects the current rows by id.
 *
 * This class is intentionally a thin transport. It contains NO game rules.
 */
export class SupabaseGameService implements GameService {
  constructor(private readonly db: SupabaseClient) {}

  async createRoom(input: CreateRoomInput): Promise<Result<Room>> {
    return this.rpcRoom('create_room', {
      p_mode: input.mode,
      p_host: input.host,
      p_difficulty: input.difficulty ?? null,
    });
  }

  async joinRoom(input: JoinRoomInput): Promise<Result<Room>> {
    return this.rpcRoom('join_room', { p_code: input.code, p_player: input.player });
  }

  async leaveRoom(ref: RoomRef): Promise<Result<void>> {
    const { error } = await this.db.rpc('leave_room', {
      p_room_id: ref.roomId,
      p_player_id: ref.playerId,
    });
    return error ? this.fail(error.message) : ok(undefined);
  }

  async setReady(ref: RoomRef & { isReady: boolean }): Promise<Result<Room>> {
    return this.rpcRoom('set_ready', {
      p_room_id: ref.roomId,
      p_player_id: ref.playerId,
      p_is_ready: ref.isReady,
    });
  }

  async startGame(ref: RoomRef): Promise<Result<Game>> {
    return this.edgeGame({ kind: 'start_game', roomId: ref.roomId, playerId: ref.playerId });
  }

  async submitMove(input: MoveInput): Promise<Result<Game>> {
    return this.edgeGame({
      kind: 'select_card',
      gameId: input.gameId,
      playerId: input.playerId,
      cardId: input.cardId,
    });
  }

  async acknowledgeReveal(input: RevealAckInput): Promise<Result<Game>> {
    return this.edgeGame({
      kind: 'end_reveal',
      gameId: input.gameId,
      playerId: input.playerId,
    });
  }

  async attemptSolvePhrase(input: SolveInput): Promise<Result<Game>> {
    return this.edgeGame({
      kind: 'solve_phrase',
      gameId: input.gameId,
      playerId: input.playerId,
      guess: input.guess,
    });
  }

  async reportTimeout(input: RevealAckInput): Promise<Result<Game>> {
    return this.edgeGame({
      kind: 'timeout',
      gameId: input.gameId,
      playerId: input.playerId,
    });
  }

  subscribeToRoom(roomId: string, cb: (room: Room) => void): Unsubscribe {
    // The room is composed from several tables, so a row change just triggers a
    // re-fetch of the canonical room_json (built by get_room). We watch both the
    // room row and its membership rows.
    const refetch = async () => {
      const { data } = await this.db.rpc('get_room', { p_room_id: roomId });
      const room = mapRoomRow(data);
      if (room) cb(room);
    };
    const channel = this.db
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => void refetch(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        () => void refetch(),
      )
      .subscribe();
    void refetch();
    return () => void this.db.removeChannel(channel);
  }

  subscribeToGame(gameId: string, cb: (game: Game) => void): Unsubscribe {
    const channel = this.db
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          const game = mapGameRow(payload.new);
          if (game) cb(game);
        },
      )
      .subscribe();
    return () => void this.db.removeChannel(channel);
  }

  async reconnectToRoom(
    ref: RoomRef,
  ): Promise<Result<{ room: Room; game: Game | null }>> {
    const { data: roomData, error: roomErr } = await this.db.rpc('get_room', {
      p_room_id: ref.roomId,
    });
    if (roomErr) return this.fail(roomErr.message);
    const room = mapRoomRow(roomData);
    if (!room) return this.fail('الغرفة غير موجودة.');

    let game: Game | null = null;
    if (room.gameId) {
      const { data: gameRow } = await this.db
        .from('games')
        .select('state')
        .eq('id', room.gameId)
        .single();
      game = gameRow ? mapGameRow(gameRow) : null;
    }
    // Mark presence (best-effort, non-blocking).
    void this.db.rpc('touch_presence', {
      p_room_id: ref.roomId,
      p_player_id: ref.playerId,
    });
    return ok({ room, game });
  }

  // --- helpers --------------------------------------------------------------

  private async rpcRoom(fn: string, args: Record<string, unknown>): Promise<Result<Room>> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) return this.fail(error.message);
    const room = mapRoomRow(data);
    return room ? ok(room) : this.fail('استجابة غير صالحة من الخادم.');
  }

  /**
   * Game mutations go through the `game-action` Edge Function, which is the
   * single authoritative writer (lock -> shared reduce -> optimistic commit).
   * supabase-js attaches the user's JWT so the function can authorize the move.
   */
  private async edgeGame(body: Record<string, unknown>): Promise<Result<Game>> {
    const { data, error } = await this.db.functions.invoke('game-action', { body });
    if (error) return this.fail(error.message);
    const game = mapGameRow((data as { state?: unknown })?.state ?? data);
    return game ? ok(game) : this.fail('استجابة غير صالحة من الخادم.');
  }

  private fail<T>(message: string): Result<T> {
    return err(moveError('GAME_NOT_IN_PROGRESS', message));
  }
}

/**
 * Row mappers. RPC functions return JSON shaped exactly like our domain types,
 * so mapping is mostly an identity cast guarded by a presence check. Keeping
 * the mapping in one place makes a future column rename a one-line change.
 */
function mapRoomRow(row: unknown): Room | null {
  if (!row || typeof row !== 'object') return null;
  return row as Room;
}

function mapGameRow(row: unknown): Game | null {
  if (!row || typeof row !== 'object') return null;
  // The games table stores the authoritative Game JSON in a `state` column.
  const maybe = row as { state?: unknown };
  const state = maybe.state ?? row;
  if (!state || typeof state !== 'object') return null;
  return state as Game;
}
