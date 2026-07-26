import { get, onValue, push, ref, remove, runTransaction, update, set } from 'firebase/database';
import type { Database } from 'firebase/database';

import type { BackendError, CreateRoomInput, TeamSetupPatch } from '../../backend/types';
import type { RejectionCode } from '../../domain/commands';
import type { RoomState } from '../../domain/game';
import type { DeviceUid, RoomCode, RoomId, TeamId } from '../../domain/ids';
import { MAX_PLAYERS_PER_TEAM, MIN_PLAYERS_PER_TEAM } from '../../domain/teams';
import {
  clampRoster,
  createInitialGame,
  createRoom as createRoomState,
  defaultRoomConfig,
  teamOfDevice,
} from '../../game/engine';
import { getFirebaseDatabase } from '../config/app';
import { serverNow } from '../time/serverTime';
import { generateRoomCode, normalizeRoomCode } from './roomCodes';
import { fromRtdb, mergeRoomIntoRaw, toRtdb } from './serialization';

// ---------------------------------------------------------------------------
// Paths & errors
// ---------------------------------------------------------------------------

export const paths = {
  room: (roomId: RoomId): string => `rooms/${roomId}`,
  team: (roomId: RoomId, teamId: TeamId): string => `rooms/${roomId}/teams/${teamId}`,
  commands: (roomId: RoomId): string => `rooms/${roomId}/commands`,
  processedCommands: (roomId: RoomId): string => `rooms/${roomId}/processedCommands`,
  processedCommand: (roomId: RoomId, commandId: string): string =>
    `rooms/${roomId}/processedCommands/${commandId}`,
  rejections: (roomId: RoomId): string => `rooms/${roomId}/rejections`,
  rejection: (roomId: RoomId, commandId: string): string =>
    `rooms/${roomId}/rejections/${commandId}`,
  presence: (roomId: RoomId): string => `rooms/${roomId}/presence`,
  presenceEntry: (roomId: RoomId, uid: DeviceUid): string => `rooms/${roomId}/presence/${uid}`,
  roomCode: (code: RoomCode): string => `roomCodes/${code}`,
} as const;

export type CodedErrorCode = BackendError['code'] | RejectionCode;

export interface CodedError extends Error {
  code: CodedErrorCode;
}

export function codedError(code: CodedErrorCode, message: string): CodedError {
  const error = new Error(message) as CodedError;
  error.code = code;
  error.name = code;
  return error;
}

function isPermissionDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /permission[_ ]denied/i.test(message);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function readRoom(roomId: RoomId): Promise<RoomState | null> {
  const db = getFirebaseDatabase();
  const snapshot = await get(ref(db, paths.room(roomId)));
  if (!snapshot.exists()) return null;
  return fromRtdb(snapshot.val());
}

export function subscribeToRoom(
  roomId: RoomId,
  cb: (room: RoomState | null) => void,
): () => void {
  const db = getFirebaseDatabase();
  const roomRef = ref(db, paths.room(roomId));
  const unsubscribe = onValue(
    roomRef,
    (snapshot) => cb(snapshot.exists() ? fromRtdb(snapshot.val()) : null),
    () => cb(null),
  );
  return () => unsubscribe();
}

// ---------------------------------------------------------------------------
// Create / join / leave
// ---------------------------------------------------------------------------

const CODE_ALLOCATION_ATTEMPTS = 8;

/**
 * Claim a code in the public index. The transaction is what makes the claim
 * safe: two hosts generating the same four characters at the same moment cannot
 * both win, and the loser simply tries another code.
 */
async function allocateCode(db: Database, roomId: RoomId, preferred: RoomCode): Promise<RoomCode> {
  let candidate = preferred;
  for (let attempt = 0; attempt < CODE_ALLOCATION_ATTEMPTS; attempt += 1) {
    const codeRef = ref(db, paths.roomCode(candidate));
    const result = await runTransaction(codeRef, (current: unknown) =>
      current === null ? roomId : undefined,
    );
    if (result.committed || result.snapshot.val() === roomId) return candidate;
    candidate = generateRoomCode();
  }
  throw codedError('UNKNOWN', 'تعذّر إنشاء رمز للغرفة، حاول مجددًا.');
}

export async function createRoom(input: CreateRoomInput): Promise<RoomState> {
  const db = getFirebaseDatabase();
  const roomId = push(ref(db, 'rooms')).key;
  if (!roomId) throw codedError('UNKNOWN', 'تعذّر إنشاء الغرفة.');

  const room = createRoomState({
    id: roomId,
    code: generateRoomCode(),
    hostUid: input.hostUid,
    config: defaultRoomConfig(input.targetScore),
    now: serverNow(),
  });

  // The room must exist before the code index points at it: the index rule
  // authorizes the write by looking up that room's hostUid.
  await set(ref(db, paths.room(roomId)), toRtdb(room));

  const code = await allocateCode(db, roomId, room.code);
  if (code !== room.code) {
    await update(ref(db, paths.room(roomId)), { code });
  }
  return { ...room, code };
}

export async function joinRoomByCode(code: RoomCode, uid: DeviceUid): Promise<RoomState> {
  const db = getFirebaseDatabase();
  const normalized = normalizeRoomCode(code);
  const indexSnapshot = await get(ref(db, paths.roomCode(normalized)));
  const roomId = indexSnapshot.val();
  if (typeof roomId !== 'string' || roomId.length === 0) {
    throw codedError('ROOM_NOT_FOUND', 'لم نجد هذه الغرفة.');
  }

  const existing = await tryReadRoom(roomId);
  if (existing) {
    // Rejoining a team this device already owns must always succeed — a refresh
    // mid-match is the common case, not an intrusion.
    if (teamOfDevice(existing, uid) !== null) return existing;
    const claimedBy = existing.teams.teamB.deviceUid;
    if (claimedBy !== null && claimedBy !== uid) {
      throw codedError('ROOM_FULL', 'الغرفة ممتلئة.');
    }
  }

  try {
    await update(ref(db, paths.team(roomId, 'teamB')), { deviceUid: uid });
  } catch (error) {
    // The rules refuse a claim on a team another device already holds, so a
    // denial here is the authoritative "full" answer even when we could not read.
    if (isPermissionDenied(error)) throw codedError('ROOM_FULL', 'الغرفة ممتلئة.');
    throw error;
  }

  const room = await readRoom(roomId);
  if (!room) throw codedError('ROOM_NOT_FOUND', 'لم نجد هذه الغرفة.');
  return room;
}

async function tryReadRoom(roomId: RoomId): Promise<RoomState | null> {
  try {
    return await readRoom(roomId);
  } catch (error) {
    if (isPermissionDenied(error)) return null;
    throw error;
  }
}

export async function leaveRoom(roomId: RoomId, uid: DeviceUid): Promise<void> {
  const db = getFirebaseDatabase();
  const room = await tryReadRoom(roomId);
  if (room) {
    const teamId = teamOfDevice(room, uid);
    if (teamId) {
      await update(ref(db, paths.team(roomId, teamId)), { deviceUid: null, ready: false });
    }
  }
  await remove(ref(db, paths.presenceEntry(roomId, uid)));
}

// ---------------------------------------------------------------------------
// Lobby edits
// ---------------------------------------------------------------------------

export async function updateTeamSetup(
  roomId: RoomId,
  teamId: TeamId,
  patch: TeamSetupPatch,
): Promise<void> {
  const db = getFirebaseDatabase();
  const room = await readRoom(roomId);
  if (!room) throw codedError('ROOM_NOT_FOUND', 'لم نجد هذه الغرفة.');
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
  const changes: Record<string, unknown> = {
    playerCount: roster.playerCount,
    players: roster.players.map((player) => ({ name: player.name })),
    activePlayerIndex: Math.min(team.activePlayerIndex, roster.playerCount - 1),
  };
  if (patch.name !== undefined) changes['name'] = patch.name;
  if (patch.color !== undefined) changes['color'] = patch.color;
  if (patch.objectSetId !== undefined) changes['objectSetId'] = patch.objectSetId;
  if (patch.ready !== undefined) changes['ready'] = patch.ready;

  await update(ref(db, paths.team(roomId, teamId)), changes);
}

export async function updateTargetScore(roomId: RoomId, targetScore: number): Promise<void> {
  const db = getFirebaseDatabase();
  if (!Number.isFinite(targetScore) || targetScore <= 0) {
    throw codedError('UNKNOWN', 'هدف نقاط غير صالح.');
  }
  const value = Math.round(targetScore);
  // The game copy is what the rules read; the config copy is what the lobby shows.
  await update(ref(db, paths.room(roomId)), {
    'config/targetScore': value,
    'game/targetScore': value,
  });
}

/**
 * Kick off the match. Runs as a transaction so a double tap on the host's
 * button cannot restart a match that is already running.
 */
export async function startMatch(roomId: RoomId): Promise<void> {
  const db = getFirebaseDatabase();
  const result = await runTransaction(ref(db, paths.room(roomId)), (raw: unknown) => {
    if (raw === null || raw === undefined) return raw;
    const room = fromRtdb(raw);
    if (room.status !== 'lobby') return undefined;
    const now = serverNow();
    const game = createInitialGame({
      targetScore: room.config.targetScore,
      seed: room.game.seed,
      startingTeamId: 'teamA',
      now,
    });
    return mergeRoomIntoRaw(raw, {
      ...room,
      status: 'in_progress',
      challenge: null,
      game: { ...game, version: room.game.version + 1 },
    });
  });

  if (!result.committed && !result.snapshot.exists()) {
    throw codedError('ROOM_NOT_FOUND', 'لم نجد هذه الغرفة.');
  }
}
