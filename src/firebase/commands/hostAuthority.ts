import { onChildAdded, onValue, ref, runTransaction } from 'firebase/database';

import type { Command, CommandType, Rejection } from '../../domain/commands';
import type { RoomState } from '../../domain/game';
import type { DeviceUid, EpochMs, RoomId, TeamId } from '../../domain/ids';
import { TEAM_IDS } from '../../domain/ids';
import { reduce } from '../../game/engine';
import { RULES } from '../../game/rules/config';
import { getFirebaseDatabase } from '../config/app';
import { paths } from '../rooms/roomService';
import { fromRtdb, mergeRoomIntoRaw } from '../rooms/serialization';
import { serverNow } from '../time/serverTime';
import {
  clearCommand,
  isCommandProcessed,
  markCommandProcessed,
  sendCommand,
  writeRejection,
} from './commandBus';

/**
 * The host device is the only writer of canonical state.
 *
 * Three properties make that safe:
 *  - idempotency: every command is stamped in `processedCommands` before its
 *    queue entry is removed, so a retry, a reconnect replay or a duplicate push
 *    can never apply the same intent twice;
 *  - atomicity: the reduce runs inside a transaction on the whole room, so two
 *    commands landing together cannot interleave into a half-applied state;
 *  - a watchdog: nothing in the game advances on a timer held by a screen. The
 *    host compares deadlines against server time and issues TURN_TIMEOUT, which
 *    is what moves the match out of countdown, resolving, challenge and a turn
 *    whose clock ran out.
 */

const WATCHDOG_INTERVAL_MS = 250;
const TIMEOUT_COMMAND_PREFIX = 'to';

const COMMAND_TYPES: readonly CommandType[] = [
  'SCAN_TARGET',
  'SUBMIT_CHALLENGE',
  'ATTEMPT_PUZZLE',
  'OPEN_PUZZLE',
  'ACK_RESOLVE',
  'TURN_TIMEOUT',
  'READY',
  'ROUND_READY',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function numberList(value: unknown): number[] {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : Object.entries(asRecord(value) ?? {})
        .map(([key, item]) => [Number(key), item] as const)
        .filter(([key]) => Number.isFinite(key))
        .sort((a, b) => a[0] - b[0])
        .map(([, item]) => item);
  return raw.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

/** A queue entry is untrusted input: anything malformed is discarded, not applied. */
function parseCommand(raw: unknown): Command | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = record['id'];
  const type = record['type'];
  const teamId = record['teamId'];
  const deviceUid = record['deviceUid'];
  const createdAt = record['createdAt'];

  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof deviceUid !== 'string' || deviceUid.length === 0) return null;
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  if (typeof teamId !== 'string' || !(TEAM_IDS as readonly string[]).includes(teamId)) return null;
  if (typeof type !== 'string' || !(COMMAND_TYPES as readonly string[]).includes(type)) return null;

  const base = {
    id,
    teamId: teamId as TeamId,
    deviceUid,
    createdAt,
  };

  switch (type as CommandType) {
    case 'SCAN_TARGET': {
      const targetId = record['targetId'];
      if (typeof targetId !== 'string') return null;
      const confidence = record['confidence'];
      return {
        ...base,
        type: 'SCAN_TARGET',
        targetId,
        confidence: typeof confidence === 'number' ? confidence : 0,
      };
    }
    case 'SUBMIT_CHALLENGE': {
      const answer = record['answer'];
      return {
        ...base,
        type: 'SUBMIT_CHALLENGE',
        answer: typeof answer === 'number' ? answer : -1,
        sequence: numberList(record['sequence']),
      };
    }
    case 'ATTEMPT_PUZZLE': {
      const answer = record['answer'];
      return { ...base, type: 'ATTEMPT_PUZZLE', answer: typeof answer === 'number' ? answer : -1 };
    }
    case 'READY':
      return { ...base, type: 'READY', ready: record['ready'] === true };
    case 'OPEN_PUZZLE':
      return { ...base, type: 'OPEN_PUZZLE' };
    case 'ACK_RESOLVE':
      return { ...base, type: 'ACK_RESOLVE' };
    case 'TURN_TIMEOUT':
      return { ...base, type: 'TURN_TIMEOUT' };
    case 'ROUND_READY':
      return { ...base, type: 'ROUND_READY' };
    default:
      return null;
  }
}

/**
 * Has the current phase's deadline passed? Mirrors exactly what `reduce` will
 * accept for TURN_TIMEOUT, so the watchdog never issues a command the engine is
 * bound to refuse.
 */
export function isDeadlinePassed(room: RoomState, now: EpochMs): boolean {
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

export function startHostAuthority(roomId: RoomId, hostUid: DeviceUid): () => void {
  const db = getFirebaseDatabase();
  const roomRef = ref(db, paths.room(roomId));
  const commandsRef = ref(db, paths.commands(roomId));

  let stopped = false;
  let latestRoom: RoomState | null = null;
  let queue: Promise<void> = Promise.resolve();

  const processedIds = new Set<string>();
  const issuedTimeoutIds = new Set<string>();
  const timeoutAttempts = new Map<string, number>();
  const timeoutKeyById = new Map<string, string>();

  const enqueue = (task: () => Promise<void>): void => {
    queue = queue.then(task).catch(() => undefined);
  };

  const applyCommand = async (entryKey: string, command: Command): Promise<void> => {
    if (stopped) return;

    // Idempotency gate. The in-memory set covers this session; the ledger in
    // the database covers a host that restarted mid-match.
    if (processedIds.has(command.id)) {
      await clearCommand(roomId, entryKey);
      return;
    }
    if (await isCommandProcessed(roomId, command.id)) {
      processedIds.add(command.id);
      await clearCommand(roomId, entryKey);
      return;
    }

    // A holder, not a plain let: the compiler cannot see assignments made
    // inside the transaction callback.
    const outcome: { rejection: Rejection | null } = { rejection: null };

    await runTransaction(
      roomRef,
      (raw: unknown) => {
        outcome.rejection = null;
        if (raw === null || raw === undefined) return raw;
        const room = fromRtdb(raw);
        const result = reduce(room, command, serverNow());
        if (!result.ok) {
          outcome.rejection = result.rejection;
          return undefined; // abort: the room is left exactly as it was
        }
        return mergeRoomIntoRaw(raw, result.value.room);
      },
      { applyLocally: false },
    );

    processedIds.add(command.id);
    await markCommandProcessed(roomId, command.id);

    const rejection = outcome.rejection;
    if (rejection) {
      await writeRejection(roomId, command.id, rejection, command.deviceUid);
      // A refused self-issued timeout must be retryable under a fresh id,
      // otherwise a clock disagreement would stall the phase forever.
      const key = timeoutKeyById.get(command.id);
      if (key) timeoutAttempts.set(key, (timeoutAttempts.get(key) ?? 0) + 1);
    }

    await clearCommand(roomId, entryKey);
  };

  const tick = async (): Promise<void> => {
    if (stopped) return;
    const room = latestRoom;
    if (!room) return;
    const now = serverNow();
    if (!isDeadlinePassed(room, now)) return;

    const key = `${room.game.version}:${room.game.phase}`;
    const attempt = timeoutAttempts.get(key) ?? 0;
    const commandId = `${TIMEOUT_COMMAND_PREFIX}_${room.game.version}_${room.game.phase}_${attempt}`;
    if (issuedTimeoutIds.has(commandId)) return;
    issuedTimeoutIds.add(commandId);
    timeoutKeyById.set(commandId, key);

    const command: Command = {
      id: commandId,
      type: 'TURN_TIMEOUT',
      teamId: room.game.activeTeamId,
      deviceUid: hostUid,
      createdAt: now,
    };
    await sendCommand(roomId, command);
  };

  const stopRoom = onValue(roomRef, (snapshot) => {
    latestRoom = snapshot.exists() ? fromRtdb(snapshot.val()) : null;
  });

  const stopCommands = onChildAdded(commandsRef, (snapshot) => {
    const entryKey = snapshot.key;
    if (!entryKey) return;
    const command = parseCommand(snapshot.val());
    if (!command) {
      enqueue(() => clearCommand(roomId, entryKey));
      return;
    }
    enqueue(() => applyCommand(entryKey, command));
  });

  const interval = setInterval(() => {
    enqueue(tick);
  }, WATCHDOG_INTERVAL_MS);

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    stopRoom();
    stopCommands();
  };
}
