import { onValue, ref } from 'firebase/database';

import type { EpochMs } from '../../domain/ids';
import { getFirebaseDatabase } from '../config/app';
import { isFirebaseConfigured } from '../config/env';

/**
 * Two phones in the same room can disagree by seconds. Every deadline in the
 * game — turn end, countdown, challenge end — is compared against this clock so
 * both devices reach the same conclusion about when time ran out.
 */

let offsetMs = 0;
let started = false;

export function startServerTimeSync(): void {
  if (started || !isFirebaseConfigured()) return;
  started = true;
  const offsetRef = ref(getFirebaseDatabase(), '.info/serverTimeOffset');
  onValue(offsetRef, (snapshot) => {
    const value = snapshot.val();
    if (typeof value === 'number' && Number.isFinite(value)) offsetMs = value;
  });
}

export function serverNow(): EpochMs {
  // Sync lazily so the first caller does not have to remember to start it.
  if (!started) startServerTimeSync();
  return Date.now() + offsetMs;
}

export function serverTimeOffsetMs(): number {
  return offsetMs;
}
