import { get, onChildAdded, push, ref, remove, set } from 'firebase/database';

import type { Command, Rejection } from '../../domain/commands';
import type { EpochMs, RoomId } from '../../domain/ids';
import { getFirebaseDatabase } from '../config/app';
import { paths } from '../rooms/roomService';
import { stripUndefined } from '../rooms/serialization';
import { serverNow } from '../time/serverTime';

/**
 * Devices never write game state; they append an intent here and the host
 * applies it. Entries are pushed (not keyed by command id) so the queue is
 * ordered by arrival — the command's own id is what the processed ledger and
 * the rejection ledger are keyed by.
 */
export async function sendCommand(roomId: RoomId, command: Command): Promise<void> {
  const db = getFirebaseDatabase();
  const entryRef = push(ref(db, paths.commands(roomId)));
  await set(entryRef, stripUndefined(command));
}

export async function markCommandProcessed(
  roomId: RoomId,
  commandId: string,
  at: EpochMs = serverNow(),
): Promise<void> {
  const db = getFirebaseDatabase();
  await set(ref(db, paths.processedCommand(roomId, commandId)), at);
}

export async function isCommandProcessed(roomId: RoomId, commandId: string): Promise<boolean> {
  const db = getFirebaseDatabase();
  const snapshot = await get(ref(db, paths.processedCommand(roomId, commandId)));
  return snapshot.exists();
}

/** Written by the host so the device that submitted can surface Arabic copy. */
export async function writeRejection(
  roomId: RoomId,
  commandId: string,
  rejection: Rejection,
  deviceUid: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  await set(ref(db, paths.rejection(roomId, commandId)), {
    code: rejection.code,
    message: rejection.message,
    deviceUid,
    at: serverNow(),
  });
}

export interface RejectionEntry {
  commandId: string;
  code: string;
  message: string;
  deviceUid: string;
  at: EpochMs;
}

export function subscribeToRejections(
  roomId: RoomId,
  cb: (entry: RejectionEntry) => void,
): () => void {
  const db = getFirebaseDatabase();
  const rejectionsRef = ref(db, paths.rejections(roomId));
  const unsubscribe = onChildAdded(rejectionsRef, (snapshot) => {
    const raw = snapshot.val();
    if (raw === null || typeof raw !== 'object') return;
    const record = raw as Record<string, unknown>;
    cb({
      commandId: snapshot.key ?? '',
      code: typeof record['code'] === 'string' ? record['code'] : 'UNKNOWN',
      message: typeof record['message'] === 'string' ? record['message'] : '',
      deviceUid: typeof record['deviceUid'] === 'string' ? record['deviceUid'] : '',
      at: typeof record['at'] === 'number' ? record['at'] : 0,
    });
  });
  return () => unsubscribe();
}

export async function clearCommand(roomId: RoomId, entryKey: string): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, `${paths.commands(roomId)}/${entryKey}`));
}
