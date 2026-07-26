import type { Command, Rejection } from '../../domain/commands';
import type { RoomState } from '../../domain/game';
import type { DeviceUid, EpochMs, RoomCode, RoomId, TeamId } from '../../domain/ids';
import { MAX_PLAYERS_PER_TEAM, MIN_PLAYERS_PER_TEAM } from '../../domain/teams';
import {
  clampRoster,
  createInitialGame,
  createRoom as createRoomState,
  defaultRoomConfig,
  randomSeed,
  reduce,
  teamOfDevice,
} from '../../game/engine';
import { RULES } from '../../game/rules/config';
import { generateRoomCode, normalizeRoomCode } from '../../firebase/rooms/roomCodes';
import { fromRtdb, toRtdb } from '../../firebase/rooms/serialization';
import type {
  ConnectionStatus,
  CreateRoomInput,
  PresenceState,
  RoomBackend,
  TeamSetupPatch,
} from '../types';

/**
 * Dev-only backend: one device, no network, no second player.
 *
 * It exists so a preview build boots into a playable match without a Firebase
 * project — the same engine, the same command flow, the same watchdog — and it
 * mirrors itself into localStorage so a refresh resumes the match. It is not
 * two-device play and must never be presented as such; `kind` is 'local' so the
 * UI can say so out loud.
 */

const STORAGE_KEY = 'qawsi.local-backend.v1';
const WATCHDOG_INTERVAL_MS = 250;
const CODE_ATTEMPTS = 16;

interface PersistedShape {
  uid: string;
  rooms: Record<RoomId, unknown>;
  codes: Record<RoomCode, RoomId>;
}

export interface LocalRejectionEntry {
  commandId: string;
  code: string;
  message: string;
  deviceUid: DeviceUid;
  at: EpochMs;
}

function codedError(code: string, message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  error.name = code;
  return error;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function newUid(): DeviceUid {
  const source = globalThis.crypto;
  if (source && typeof source.randomUUID === 'function') return `local_${source.randomUUID()}`;
  return `local_${randomSeed().toString(36)}${randomSeed().toString(36)}`;
}

/** Same deadline test the Firebase host watchdog uses, kept local so this
 *  backend never pulls the Firebase SDK into the bundle path it runs on. */
function isDeadlinePassed(room: RoomState, now: EpochMs): boolean {
  const game = room.game;
  switch (game.phase) {
    case 'countdown':
      return game.countdownEndsAt !== null && now >= game.countdownEndsAt;
    case 'resolving':
      return game.lastOutcome !== null && now >= game.lastOutcome.at + RULES.resolveDisplayMs;
    case 'scanning_first':
    case 'scanning_second':
      return now > game.turnEndsAt;
    case 'challenge':
      return room.challenge !== null && now >= room.challenge.endsAt;
    default:
      return false;
  }
}

export class LocalRoomBackend implements RoomBackend {
  readonly kind = 'local' as const;

  private uid: DeviceUid;
  private readonly rooms = new Map<RoomId, RoomState>();
  private readonly codes = new Map<RoomCode, RoomId>();
  private readonly roomListeners = new Map<RoomId, Set<(room: RoomState | null) => void>>();
  private readonly presenceListeners = new Map<RoomId, Set<(presence: PresenceState) => void>>();
  private readonly rejectionListeners = new Map<
    RoomId,
    Set<(entry: LocalRejectionEntry) => void>
  >();
  private readonly rejections = new Map<RoomId, LocalRejectionEntry[]>();
  private readonly processed = new Map<RoomId, Set<string>>();
  private readonly timeoutAttempts = new Map<string, number>();

  constructor() {
    const restored = this.restore();
    this.uid = restored;
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private restore(): DeviceUid {
    const store = storage();
    if (!store) return newUid();
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return newUid();
      const parsed = JSON.parse(raw) as Partial<PersistedShape>;
      for (const [roomId, serialized] of Object.entries(parsed.rooms ?? {})) {
        this.rooms.set(roomId, fromRtdb(serialized));
      }
      for (const [code, roomId] of Object.entries(parsed.codes ?? {})) {
        if (typeof roomId === 'string') this.codes.set(code, roomId);
      }
      return typeof parsed.uid === 'string' && parsed.uid.length > 0 ? parsed.uid : newUid();
    } catch {
      return newUid();
    }
  }

  private persist(): void {
    const store = storage();
    if (!store) return;
    const rooms: Record<RoomId, unknown> = {};
    for (const [roomId, room] of this.rooms) rooms[roomId] = toRtdb(room);
    const codes: Record<RoomCode, RoomId> = {};
    for (const [code, roomId] of this.codes) codes[code] = roomId;
    const payload: PersistedShape = { uid: this.uid, rooms, codes };
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // A full or disabled localStorage costs persistence, never the match.
    }
  }

  private commit(room: RoomState): void {
    this.rooms.set(room.id, room);
    this.persist();
    const listeners = this.roomListeners.get(room.id);
    if (listeners) for (const listener of listeners) listener(room);
    this.emitPresence(room.id);
  }

  private requireRoom(roomId: RoomId): RoomState {
    const room = this.rooms.get(roomId);
    if (!room) throw codedError('ROOM_NOT_FOUND', 'لم نجد هذه الغرفة.');
    return room;
  }

  // -------------------------------------------------------------------------
  // Identity & rooms
  // -------------------------------------------------------------------------

  async ensureIdentity(): Promise<DeviceUid> {
    if (!this.uid) this.uid = newUid();
    this.persist();
    return this.uid;
  }

  async createRoom(input: CreateRoomInput): Promise<RoomState> {
    const roomId = `local_${Date.now().toString(36)}_${randomSeed().toString(36)}`;
    let code = generateRoomCode();
    for (let attempt = 0; attempt < CODE_ATTEMPTS && this.codes.has(code); attempt += 1) {
      code = generateRoomCode();
    }
    const room = createRoomState({
      id: roomId,
      code,
      hostUid: input.hostUid,
      config: defaultRoomConfig(input.targetScore),
      now: this.now(),
    });
    this.codes.set(code, roomId);
    this.commit(room);
    return room;
  }

  async joinRoomByCode(code: RoomCode, uid: DeviceUid): Promise<RoomState> {
    const roomId = this.codes.get(normalizeRoomCode(code));
    if (!roomId) throw codedError('ROOM_NOT_FOUND', 'لم نجد هذه الغرفة.');
    const room = this.requireRoom(roomId);

    const teamB = room.teams.teamB;
    if (teamB.deviceUid !== null && teamB.deviceUid !== uid) {
      throw codedError('ROOM_FULL', 'الغرفة ممتلئة.');
    }
    if (teamB.deviceUid === uid) return room;

    // On a single device the host drives both teams; claiming teamB with the
    // same uid is the normal path here, not an error.
    const next: RoomState = {
      ...room,
      teams: { ...room.teams, teamB: { ...teamB, deviceUid: uid } },
    };
    this.commit(next);
    return next;
  }

  async leaveRoom(roomId: RoomId, uid: DeviceUid): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const teamId = teamOfDevice(room, uid);
    if (!teamId) return;
    const team = room.teams[teamId];
    this.commit({
      ...room,
      teams: { ...room.teams, [teamId]: { ...team, deviceUid: null, ready: false } },
    });
  }

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  subscribeToRoom(roomId: RoomId, cb: (room: RoomState | null) => void): () => void {
    const listeners = this.roomListeners.get(roomId) ?? new Set();
    listeners.add(cb);
    this.roomListeners.set(roomId, listeners);
    cb(this.rooms.get(roomId) ?? null);
    return () => {
      listeners.delete(cb);
    };
  }

  private presenceOf(roomId: RoomId): PresenceState {
    const room = this.rooms.get(roomId);
    if (!room) return { online: {}, hostPresent: false };
    const online: Record<DeviceUid, boolean> = { [room.hostUid]: true };
    for (const team of [room.teams.teamA, room.teams.teamB]) {
      if (team.deviceUid !== null) online[team.deviceUid] = true;
    }
    return { online, hostPresent: true };
  }

  private emitPresence(roomId: RoomId): void {
    const listeners = this.presenceListeners.get(roomId);
    if (!listeners) return;
    const presence = this.presenceOf(roomId);
    for (const listener of listeners) listener(presence);
  }

  subscribeToPresence(roomId: RoomId, cb: (presence: PresenceState) => void): () => void {
    const listeners = this.presenceListeners.get(roomId) ?? new Set();
    listeners.add(cb);
    this.presenceListeners.set(roomId, listeners);
    cb(this.presenceOf(roomId));
    return () => {
      listeners.delete(cb);
    };
  }

  subscribeToConnection(cb: (status: ConnectionStatus) => void): () => void {
    cb('online');
    return () => undefined;
  }

  /** Mirrors the Firebase rejection ledger so the UI can surface Arabic copy. */
  subscribeToRejections(roomId: RoomId, cb: (entry: LocalRejectionEntry) => void): () => void {
    const listeners = this.rejectionListeners.get(roomId) ?? new Set();
    listeners.add(cb);
    this.rejectionListeners.set(roomId, listeners);
    return () => {
      listeners.delete(cb);
    };
  }

  private recordRejection(roomId: RoomId, command: Command, rejection: Rejection): void {
    const entry: LocalRejectionEntry = {
      commandId: command.id,
      code: rejection.code,
      message: rejection.message,
      deviceUid: command.deviceUid,
      at: this.now(),
    };
    const log = this.rejections.get(roomId) ?? [];
    log.push(entry);
    this.rejections.set(roomId, log.slice(-32));
    const listeners = this.rejectionListeners.get(roomId);
    if (listeners) for (const listener of listeners) listener(entry);
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  /**
   * Host authority runs inline: this device is always its own host, so there is
   * no queue to drain and no transaction to win. Idempotency is still enforced
   * so a double-tapped button behaves the same as it does online.
   */
  private applyCommand(roomId: RoomId, command: Command): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const seen = this.processed.get(roomId) ?? new Set<string>();
    if (seen.has(command.id)) return;
    seen.add(command.id);
    this.processed.set(roomId, seen);

    const result = reduce(room, command, this.now());
    if (!result.ok) {
      this.recordRejection(roomId, command, result.rejection);
      return;
    }
    this.commit(result.value.room);
  }

  async sendCommand(roomId: RoomId, command: Command): Promise<void> {
    this.applyCommand(roomId, command);
  }

  startHostAuthority(roomId: RoomId, hostUid: DeviceUid): () => void {
    const interval = setInterval(() => {
      const room = this.rooms.get(roomId);
      if (!room) return;
      const now = this.now();
      if (!isDeadlinePassed(room, now)) return;

      const key = `${roomId}:${room.game.version}:${room.game.phase}`;
      const attempt = this.timeoutAttempts.get(key) ?? 0;
      const commandId = `to_${room.game.version}_${room.game.phase}_${attempt}`;
      const before = room.game.version;

      this.applyCommand(roomId, {
        id: commandId,
        type: 'TURN_TIMEOUT',
        teamId: room.game.activeTeamId,
        deviceUid: hostUid,
        createdAt: now,
      });

      // Refused (clock or phase disagreement): allow a fresh id next tick.
      const after = this.rooms.get(roomId)?.game.version ?? before;
      if (after === before) this.timeoutAttempts.set(key, attempt + 1);
    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(interval);
  }

  // -------------------------------------------------------------------------
  // Lobby edits
  // -------------------------------------------------------------------------

  async updateTeamSetup(roomId: RoomId, teamId: TeamId, patch: TeamSetupPatch): Promise<void> {
    const room = this.requireRoom(roomId);
    if (room.status !== 'lobby') {
      throw codedError('WRONG_PHASE', 'لا يمكن تعديل الإعداد بعد بدء المباراة.');
    }
    const team = room.teams[teamId];
    const requestedCount =
      patch.playerCount ?? (patch.players ? patch.players.length : team.playerCount);
    if (requestedCount > MAX_PLAYERS_PER_TEAM || requestedCount < MIN_PLAYERS_PER_TEAM) {
      throw codedError('TOO_MANY_PLAYERS', 'الحد الأقصى ثلاثة لاعبين لكل فريق.');
    }
    const roster = clampRoster(patch.players ?? team.players, requestedCount);

    this.commit({
      ...room,
      teams: {
        ...room.teams,
        [teamId]: {
          ...team,
          name: patch.name ?? team.name,
          color: patch.color ?? team.color,
          objectSetId: patch.objectSetId ?? team.objectSetId,
          ready: patch.ready ?? team.ready,
          playerCount: roster.playerCount,
          players: roster.players.map((player) => ({ name: player.name })),
          activePlayerIndex: Math.min(team.activePlayerIndex, roster.playerCount - 1),
        },
      },
    });
  }

  async updateTargetScore(roomId: RoomId, targetScore: number): Promise<void> {
    const room = this.requireRoom(roomId);
    if (!Number.isFinite(targetScore) || targetScore <= 0) {
      throw codedError('UNKNOWN', 'هدف نقاط غير صالح.');
    }
    const value = Math.round(targetScore);
    this.commit({
      ...room,
      config: { ...room.config, targetScore: value },
      game: { ...room.game, targetScore: value },
    });
  }

  async startMatch(roomId: RoomId): Promise<void> {
    const room = this.requireRoom(roomId);
    if (room.status !== 'lobby') return;
    const game = createInitialGame({
      targetScore: room.config.targetScore,
      seed: room.game.seed,
      startingTeamId: 'teamA',
      now: this.now(),
    });
    this.commit({
      ...room,
      status: 'in_progress',
      challenge: null,
      game: { ...game, version: room.game.version + 1 },
    });
  }

  /** No server to sync with — on one device the local clock is the only clock. */
  now(): EpochMs {
    return Date.now();
  }
}

export function createLocalRoomBackend(): RoomBackend {
  return new LocalRoomBackend();
}
