import type { RoomBackend } from '../backend/types';
import { ensureAnonymousUid } from './auth/anonymousAuth';
import { sendCommand } from './commands/commandBus';
import { startHostAuthority } from './commands/hostAuthority';
import { isFirebaseConfigured } from './config/env';
import { attachPresence, detachPresence, subscribeToConnection, subscribeToPresence } from './presence/presence';
import {
  createRoom,
  joinRoomByCode,
  leaveRoom,
  startMatch,
  subscribeToRoom,
  updateTargetScore,
  updateTeamSetup,
} from './rooms/roomService';
import { serverNow, startServerTimeSync } from './time/serverTime';

export { isFirebaseConfigured, firebaseEnv } from './config/env';
export { subscribeToRejections } from './commands/commandBus';
export type { RejectionEntry } from './commands/commandBus';
export { fromRtdb, toRtdb } from './rooms/serialization';
export { generateRoomCode, normalizeRoomCode, isValidRoomCode } from './rooms/roomCodes';
export { serverNow } from './time/serverTime';

/**
 * The realtime backend. Nothing here touches the network until a method is
 * called, so constructing it in an unconfigured build is harmless.
 */
export function createFirebaseBackend(): RoomBackend {
  return {
    kind: 'firebase',

    async ensureIdentity() {
      startServerTimeSync();
      return ensureAnonymousUid();
    },

    async createRoom(input) {
      const room = await createRoom(input);
      attachPresence(room.id, input.hostUid);
      return room;
    },

    async joinRoomByCode(code, uid) {
      const room = await joinRoomByCode(code, uid);
      attachPresence(room.id, uid);
      return room;
    },

    async leaveRoom(roomId, uid) {
      detachPresence(roomId, uid);
      await leaveRoom(roomId, uid);
    },

    subscribeToRoom,
    subscribeToPresence,
    subscribeToConnection,

    async sendCommand(roomId, command) {
      await sendCommand(roomId, command);
    },

    updateTeamSetup,
    updateTargetScore,
    startMatch,
    startHostAuthority,

    now: serverNow,
  };
}

export function isRealtimeConfigured(): boolean {
  return isFirebaseConfigured();
}
