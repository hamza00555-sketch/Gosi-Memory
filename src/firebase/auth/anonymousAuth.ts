import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/auth';

import type { DeviceUid } from '../../domain/ids';
import { getFirebaseAuth } from '../config/app';

/**
 * Anonymous identity is the device's identity for the whole match: the security
 * rules pin every command and every team claim to this uid, and Firebase
 * persists it across reloads so a refresh mid-match rejoins the same team.
 */

let pending: Promise<DeviceUid> | null = null;

export function ensureAnonymousUid(): Promise<DeviceUid> {
  if (pending) return pending;

  pending = new Promise<DeviceUid>((resolve, reject) => {
    const auth = getFirebaseAuth();
    let settled = false;
    let unsubscribe: Unsubscribe | null = null;
    let unsubscribeRequested = false;

    const stop = (): void => {
      if (unsubscribe) unsubscribe();
      else unsubscribeRequested = true;
    };

    const finish = (uid: DeviceUid): void => {
      if (settled) return;
      settled = true;
      stop();
      resolve(uid);
    };

    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      stop();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const handle = onAuthStateChanged(
      auth,
      (user) => {
        if (user) finish(user.uid);
      },
      (error) => fail(error),
    );
    unsubscribe = handle;
    if (unsubscribeRequested) handle();

    if (!auth.currentUser) {
      // Resolution still happens through the listener above so a restored
      // session and a fresh sign-in take exactly the same path.
      void signInAnonymously(auth).catch(fail);
    }
  });

  // A failed sign-in must not poison every later attempt.
  pending.catch(() => {
    pending = null;
  });

  return pending;
}

/** The uid we already hold, without triggering a sign-in. */
export function currentUid(): DeviceUid | null {
  try {
    return getFirebaseAuth().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}
