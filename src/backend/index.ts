import { createFirebaseBackend } from '../firebase';
import { isFirebaseConfigured } from '../firebase/config/env';
import { createLocalRoomBackend } from './local/LocalRoomBackend';
import type { RoomBackend } from './types';

/**
 * One backend per app run. Choosing it lazily keeps the decision out of module
 * scope, so importing this file never initializes Firebase — an unconfigured
 * build boots straight into the offline dev backend instead of failing.
 */

let instance: RoomBackend | null = null;

export function getBackend(): RoomBackend {
  if (!instance) {
    instance = isFirebaseConfigured() ? createFirebaseBackend() : createLocalRoomBackend();
  }
  return instance;
}

/** True only when real two-device play is available. Surface it in the UI. */
export function isRealtimeAvailable(): boolean {
  return isFirebaseConfigured();
}

/** Test seam — drops the memoized instance. */
export function resetBackend(): void {
  instance = null;
}

export type {
  BackendError,
  ConnectionStatus,
  CreateRoomInput,
  PresenceState,
  RoomBackend,
  TeamSetupPatch,
} from './types';
