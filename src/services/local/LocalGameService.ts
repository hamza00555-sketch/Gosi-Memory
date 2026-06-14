import {
  createAiMemory,
  playAiTurn,
  type AiDifficulty,
  type AiMemory,
} from '../../core/ai/ai';
import { getDefaultConfig } from '../../core/engine/config';
import { err, moveError, ok, type Result } from '../../core/engine/errors';
import { initGame, reduce } from '../../core/engine/engine';
import { pickPhrase } from '../../core/content/phrases';
import { getDefaultCosmetic } from '../../core/content/cosmetics';
import { createRng, randomSeed } from '../../core/utils/rng';
import { generateId, generateRoomCode } from '../../core/utils/id';
import type { GameConfig } from '../../core/types/config';
import type { Game } from '../../core/types/game';
import type { PlayerId, TeamId } from '../../core/types/ids';
import type { RoomMember } from '../../core/types/player';
import type { GameMode, Room, Team } from '../../core/types/room';
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
import { loadState, saveState } from './persistence';

export const AI_PLAYER_ID = 'ai_bot';
const AI_TURN_DELAY_MS = 700;

interface RoomRuntime {
  config: GameConfig;
  difficulty: AiDifficulty;
  aiMemory: AiMemory;
}

/**
 * Fully offline, in-process implementation of GameService. It is authoritative
 * for solo play and acts as a faithful stand-in for online modes during local
 * development. All rules go through the shared engine — no logic is duplicated.
 */
export class LocalGameService implements GameService {
  private rooms = new Map<string, Room>();
  private games = new Map<string, Game>();
  private runtimes = new Map<string, RoomRuntime>();
  private roomSubs = new Map<string, Set<(room: Room) => void>>();
  private gameSubs = new Map<string, Set<(game: Game) => void>>();
  private now = () => Date.now();

  constructor() {
    const state = loadState();
    for (const room of Object.values(state.rooms)) this.rooms.set(room.id, room);
    for (const game of Object.values(state.games)) this.games.set(game.id, game);
  }

  // --- Room lifecycle -------------------------------------------------------

  async createRoom(input: CreateRoomInput): Promise<Result<Room>> {
    const now = this.now();
    const roomId = generateId('room');
    const hostMember = this.toMember(input.host, null, false);
    const members: RoomMember[] = [hostMember];
    const teams: Team[] = [];

    if (input.mode === 'solo_ai') {
      members.push({
        playerId: AI_PLAYER_ID,
        displayName: 'القوسي',
        avatarUrl: null,
        isReady: true,
        isConnected: true,
        teamId: null,
        lastSeenAt: now,
      });
    }

    const room: Room = {
      id: roomId,
      code: generateRoomCode(),
      mode: input.mode,
      status: 'waiting',
      hostId: input.host.playerId,
      members,
      teams,
      gameId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.runtimes.set(roomId, {
      config: getDefaultConfig(input.mode),
      difficulty: input.difficulty ?? 'medium',
      aiMemory: createAiMemory(),
    });

    this.rooms.set(roomId, room);
    this.recomputeStatus(room);
    this.persist();
    this.emitRoom(room);
    return ok(room);
  }

  async joinRoom(input: JoinRoomInput): Promise<Result<Room>> {
    const room = [...this.rooms.values()].find((r) => r.code === input.code);
    if (!room) return err(moveError('CARD_NOT_FOUND', 'الغرفة غير موجودة.'));
    if (room.status === 'in_progress' || room.status === 'completed') {
      return err(moveError('GAME_NOT_IN_PROGRESS', 'اللعبة بدأت بالفعل.'));
    }
    const capacity = this.capacityFor(room.mode);
    const humans = room.members.filter((m) => m.playerId !== AI_PLAYER_ID);
    const existing = humans.find((m) => m.playerId === input.player.playerId);
    if (!existing && humans.length >= capacity) {
      return err(moveError('TOO_MANY_SELECTED', 'الغرفة ممتلئة.'));
    }
    if (!existing) {
      room.members.push(this.toMember(input.player, null, false));
    } else {
      existing.isConnected = true;
      existing.lastSeenAt = this.now();
    }
    room.updatedAt = this.now();
    this.recomputeStatus(room);
    this.persist();
    this.emitRoom(room);
    return ok(room);
  }

  async leaveRoom(ref: RoomRef): Promise<Result<void>> {
    const room = this.rooms.get(ref.roomId);
    if (!room) return ok(undefined);
    room.members = room.members.filter((m) => m.playerId !== ref.playerId);
    room.updatedAt = this.now();
    if (room.members.filter((m) => m.playerId !== AI_PLAYER_ID).length === 0) {
      this.rooms.delete(room.id);
    } else {
      if (room.hostId === ref.playerId) {
        room.hostId = room.members.find((m) => m.playerId !== AI_PLAYER_ID)!.playerId;
      }
      this.recomputeStatus(room);
      this.emitRoom(room);
    }
    this.persist();
    return ok(undefined);
  }

  async setReady(ref: RoomRef & { isReady: boolean }): Promise<Result<Room>> {
    const room = this.rooms.get(ref.roomId);
    if (!room) return err(moveError('CARD_NOT_FOUND', 'الغرفة غير موجودة.'));
    const member = room.members.find((m) => m.playerId === ref.playerId);
    if (!member) return err(moveError('NOT_YOUR_TURN', 'لست في هذه الغرفة.'));
    member.isReady = ref.isReady;
    room.updatedAt = this.now();
    this.recomputeStatus(room);
    this.persist();
    this.emitRoom(room);
    return ok(room);
  }

  async startGame(ref: RoomRef): Promise<Result<Game>> {
    const room = this.rooms.get(ref.roomId);
    if (!room) return err(moveError('CARD_NOT_FOUND', 'الغرفة غير موجودة.'));
    if (room.hostId !== ref.playerId) {
      return err(moveError('NOT_YOUR_TURN', 'المضيف فقط يبدأ اللعبة.'));
    }
    if (room.status !== 'ready') {
      return err(moveError('WRONG_PHASE', 'اللاعبون غير جاهزين.'));
    }

    const runtime = this.runtimes.get(room.id) ?? {
      config: getDefaultConfig(room.mode),
      difficulty: 'medium' as AiDifficulty,
      aiMemory: createAiMemory(),
    };
    const seed = randomSeed();
    const { turnOrder, teams, teamByPlayer } = this.buildTurnOrder(room);
    room.teams = teams;

    const phrase = pickPhrase(runtime.config.phraseDifficulty, seed);
    const backSkin = getDefaultCosmetic('card_skin').id;

    const game = initGame({
      id: generateId('game'),
      roomId: room.id,
      mode: room.mode,
      config: runtime.config,
      phrase,
      turnOrder,
      teamByPlayer,
      backSkinId: backSkin,
      seed,
      startedAt: this.now(),
    });

    this.games.set(game.id, game);
    room.gameId = game.id;
    room.status = 'in_progress';
    room.updatedAt = this.now();
    this.runtimes.set(room.id, runtime);
    this.persist();
    this.emitRoom(room);
    this.emitGame(game);
    this.maybeRunAi(game.id);
    return ok(game);
  }

  // --- In-game actions ------------------------------------------------------

  async submitMove(input: MoveInput): Promise<Result<Game>> {
    return this.apply(input.gameId, {
      type: 'SELECT_CARD',
      playerId: input.playerId,
      cardId: input.cardId,
    });
  }

  async acknowledgeReveal(input: RevealAckInput): Promise<Result<Game>> {
    return this.apply(input.gameId, { type: 'END_REVEAL', playerId: input.playerId });
  }

  async attemptSolvePhrase(input: SolveInput): Promise<Result<Game>> {
    return this.apply(input.gameId, {
      type: 'SOLVE_PHRASE',
      playerId: input.playerId,
      guess: input.guess,
    });
  }

  async reportTimeout(input: RevealAckInput): Promise<Result<Game>> {
    return this.apply(input.gameId, { type: 'TIMEOUT', playerId: input.playerId });
  }

  // --- Realtime + reconnection ---------------------------------------------

  subscribeToRoom(roomId: string, cb: (room: Room) => void): Unsubscribe {
    const set = this.roomSubs.get(roomId) ?? new Set();
    set.add(cb);
    this.roomSubs.set(roomId, set);
    const current = this.rooms.get(roomId);
    if (current) cb(current);
    return () => set.delete(cb);
  }

  subscribeToGame(gameId: string, cb: (game: Game) => void): Unsubscribe {
    const set = this.gameSubs.get(gameId) ?? new Set();
    set.add(cb);
    this.gameSubs.set(gameId, set);
    const current = this.games.get(gameId);
    if (current) cb(current);
    return () => set.delete(cb);
  }

  async reconnectToRoom(
    ref: RoomRef,
  ): Promise<Result<{ room: Room; game: Game | null }>> {
    const room = this.rooms.get(ref.roomId);
    if (!room) return err(moveError('CARD_NOT_FOUND', 'الغرفة غير موجودة.'));
    const member = room.members.find((m) => m.playerId === ref.playerId);
    if (member) {
      member.isConnected = true;
      member.lastSeenAt = this.now();
    }
    const game = room.gameId ? this.games.get(room.gameId) ?? null : null;
    this.emitRoom(room);
    return ok({ room, game });
  }

  // --- Internals ------------------------------------------------------------

  private apply(
    gameId: string,
    action: Parameters<typeof reduce>[1],
  ): Result<Game> {
    const game = this.games.get(gameId);
    if (!game) return err(moveError('CARD_NOT_FOUND', 'اللعبة غير موجودة.'));
    const runtime = this.runtimes.get(game.roomId);
    const config = runtime?.config ?? getDefaultConfig(game.mode);

    const result = reduce(game, action, config, this.now());
    if (!result.ok) return result;

    this.games.set(gameId, result.value.game);
    this.persist();
    this.emitGame(result.value.game);
    if (result.value.game.status === 'completed') this.completeRoom(result.value.game);
    else this.maybeRunAi(gameId);
    return ok(result.value.game);
  }

  /** If it is the AI's turn, let it play after a short, human-like delay. */
  private maybeRunAi(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'in_progress') return;
    if (game.currentTurnPlayerId !== AI_PLAYER_ID) return;
    const runtime = this.runtimes.get(game.roomId);
    if (!runtime) return;

    setTimeout(() => {
      const current = this.games.get(gameId);
      if (!current || current.currentTurnPlayerId !== AI_PLAYER_ID) return;
      const next = playAiTurn(
        current,
        runtime.config,
        runtime.aiMemory,
        runtime.difficulty,
        createRng(current.seed ^ current.version),
        this.now,
      );
      this.games.set(gameId, next);
      this.persist();
      this.emitGame(next);
      if (next.status === 'completed') this.completeRoom(next);
    }, AI_TURN_DELAY_MS);
  }

  private completeRoom(game: Game): void {
    const room = this.rooms.get(game.roomId);
    if (!room) return;
    room.status = 'completed';
    room.updatedAt = this.now();
    this.persist();
    this.emitRoom(room);
  }

  private buildTurnOrder(room: Room): {
    turnOrder: PlayerId[];
    teams: Team[];
    teamByPlayer: Record<PlayerId, TeamId>;
  } {
    const players = room.members.map((m) => m.playerId);
    if (room.mode !== 'two_vs_two') {
      return { turnOrder: players, teams: [], teamByPlayer: {} };
    }
    // Split into two teams and interleave so turns alternate sides.
    const teamA: PlayerId[] = [];
    const teamB: PlayerId[] = [];
    players.forEach((p, i) => (i % 2 === 0 ? teamA : teamB).push(p));
    const teamByPlayer: Record<PlayerId, TeamId> = {};
    teamA.forEach((p) => (teamByPlayer[p] = 'team_a'));
    teamB.forEach((p) => (teamByPlayer[p] = 'team_b'));
    const turnOrder: PlayerId[] = [];
    const max = Math.max(teamA.length, teamB.length);
    for (let i = 0; i < max; i++) {
      if (teamA[i]) turnOrder.push(teamA[i]!);
      if (teamB[i]) turnOrder.push(teamB[i]!);
    }
    const teams: Team[] = [
      { id: 'team_a', name: 'الفريق الأزرق', memberIds: teamA },
      { id: 'team_b', name: 'الفريق الأخضر', memberIds: teamB },
    ];
    return { turnOrder, teams, teamByPlayer };
  }

  private capacityFor(mode: GameMode): number {
    if (mode === 'solo_ai') return 1;
    if (mode === 'one_vs_one') return 2;
    return 4;
  }

  private recomputeStatus(room: Room): void {
    if (room.status === 'in_progress' || room.status === 'completed') return;
    const humans = room.members.filter((m) => m.playerId !== AI_PLAYER_ID);
    const capacity = this.capacityFor(room.mode);
    const full = humans.length >= capacity;
    const allReady = room.members.every((m) => m.isReady);
    room.status = full && allReady ? 'ready' : 'waiting';
  }

  private toMember(
    p: { playerId: string; displayName: string; avatarUrl: string | null },
    teamId: string | null,
    isReady: boolean,
  ): RoomMember {
    return {
      playerId: p.playerId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isReady,
      isConnected: true,
      teamId,
      lastSeenAt: this.now(),
    };
  }

  private emitRoom(room: Room): void {
    this.roomSubs.get(room.id)?.forEach((cb) => cb(structuredCloneSafe(room)));
  }

  private emitGame(game: Game): void {
    this.gameSubs.get(game.id)?.forEach((cb) => cb(structuredCloneSafe(game)));
  }

  private persist(): void {
    saveState({
      rooms: Object.fromEntries(this.rooms),
      games: Object.fromEntries(this.games),
    });
  }
}

/** Defensive clone so subscribers never mutate internal state. */
function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
