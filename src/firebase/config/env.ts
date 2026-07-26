/**
 * Build-time Firebase configuration.
 *
 * Reading is total: a missing variable becomes an empty string rather than a
 * throw, because the app must still boot into local mode on a machine that has
 * never seen a Firebase project.
 */

export interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /** Point the SDK at the local emulator suite instead of the cloud project. */
  useEmulator: boolean;
}

function read(key: string): string {
  const source = import.meta.env as unknown as Record<string, string | undefined>;
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

export const firebaseEnv: FirebaseEnv = {
  apiKey: read('VITE_FIREBASE_API_KEY'),
  authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
  databaseURL: read('VITE_FIREBASE_DATABASE_URL'),
  projectId: read('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: read('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: read('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: read('VITE_FIREBASE_APP_ID'),
  useEmulator: read('VITE_FIREBASE_EMULATOR') === 'true',
};

/**
 * The five fields the Realtime Database + anonymous auth path actually needs.
 * storageBucket and messagingSenderId are carried through for completeness but
 * are not required to play.
 */
export function isFirebaseConfigured(): boolean {
  return (
    firebaseEnv.apiKey.length > 0 &&
    firebaseEnv.authDomain.length > 0 &&
    firebaseEnv.databaseURL.length > 0 &&
    firebaseEnv.projectId.length > 0 &&
    firebaseEnv.appId.length > 0
  );
}

export function isEmulatorEnabled(): boolean {
  return firebaseEnv.useEmulator;
}
