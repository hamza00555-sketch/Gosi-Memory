import { onDisconnect, onValue, ref, remove, set } from 'firebase/database';

import type { ConnectionStatus, PresenceState } from '../../backend/types';
import type { DeviceUid, RoomId } from '../../domain/ids';
import { getFirebaseDatabase } from '../config/app';
import { paths } from '../rooms/roomService';

/**
 * Presence is written by the client but removed by the server: `onDisconnect`
 * is registered while the socket is healthy, so a phone that is locked, loses
 * signal or is force-quit still disappears from the room. A client-side
 * "goodbye" write can never be relied on for that.
 */

interface PresenceHandle {
  detach: () => void;
}

const attached = new Map<string, PresenceHandle>();

function handleKey(roomId: RoomId, uid: DeviceUid): string {
  return `${roomId}::${uid}`;
}

export function attachPresence(roomId: RoomId, uid: DeviceUid): () => void {
  const key = handleKey(roomId, uid);
  const existing = attached.get(key);
  if (existing) return existing.detach;

  const db = getFirebaseDatabase();
  const entryRef = ref(db, paths.presenceEntry(roomId, uid));
  const connectedRef = ref(db, '.info/connected');

  const stopConnected = onValue(connectedRef, (snapshot) => {
    if (snapshot.val() !== true) return;
    // The disconnect hook has to be re-registered after every reconnect;
    // the server discards it once it fires.
    void onDisconnect(entryRef)
      .remove()
      .then(() => set(entryRef, true))
      .catch(() => undefined);
  });

  const detach = (): void => {
    attached.delete(key);
    stopConnected();
    void onDisconnect(entryRef).cancel().catch(() => undefined);
    void remove(entryRef).catch(() => undefined);
  };

  attached.set(key, { detach });
  return detach;
}

export function detachPresence(roomId: RoomId, uid: DeviceUid): void {
  attached.get(handleKey(roomId, uid))?.detach();
}

export function subscribeToPresence(
  roomId: RoomId,
  cb: (presence: PresenceState) => void,
): () => void {
  const db = getFirebaseDatabase();
  let hostUid: string | null = null;
  let online: Record<DeviceUid, boolean> = {};

  const emit = (): void => {
    cb({ online, hostPresent: hostUid !== null && online[hostUid] === true });
  };

  const stopHost = onValue(ref(db, `${paths.room(roomId)}/hostUid`), (snapshot) => {
    const value = snapshot.val();
    hostUid = typeof value === 'string' ? value : null;
    emit();
  });

  const stopPresence = onValue(ref(db, paths.presence(roomId)), (snapshot) => {
    const raw = snapshot.val();
    const next: Record<DeviceUid, boolean> = {};
    if (raw !== null && typeof raw === 'object') {
      for (const [uid, value] of Object.entries(raw as Record<string, unknown>)) {
        if (value !== null && value !== false) next[uid] = true;
      }
    }
    online = next;
    emit();
  });

  return () => {
    stopHost();
    stopPresence();
  };
}

/**
 * Socket-level connectivity only. `host_absent` is a room-level conclusion the
 * caller reaches by combining this with presence, since this stream is not
 * scoped to a room.
 */
export function subscribeToConnection(cb: (status: ConnectionStatus) => void): () => void {
  cb('connecting');
  const db = getFirebaseDatabase();
  const unsubscribe = onValue(
    ref(db, '.info/connected'),
    (snapshot) => cb(snapshot.val() === true ? 'online' : 'offline'),
    () => cb('offline'),
  );
  return () => unsubscribe();
}
