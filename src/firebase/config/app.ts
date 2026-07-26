import { getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import type { Database } from 'firebase/database';

import { firebaseEnv, isEmulatorEnabled, isFirebaseConfigured } from './env';

/**
 * Everything here is lazy. Importing this module must never initialize the SDK,
 * open a socket, or throw — an unconfigured build has to reach the local
 * backend without tripping over Firebase on the way.
 */

const APP_NAME = 'qawsi';
const EMULATOR_HOST = '127.0.0.1';
const AUTH_EMULATOR_PORT = 9099;
const DATABASE_EMULATOR_PORT = 9000;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDatabase: Database | null = null;

export class FirebaseNotConfiguredError extends Error {
  readonly code = 'NOT_CONFIGURED' as const;
  constructor() {
    super('إعدادات Firebase غير مكتملة — اللعب بين جهازين غير مفعّل.');
    this.name = 'FirebaseNotConfiguredError';
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  if (!isFirebaseConfigured()) throw new FirebaseNotConfiguredError();

  const existing = getApps().find((app) => app.name === APP_NAME);
  cachedApp =
    existing ??
    initializeApp(
      {
        apiKey: firebaseEnv.apiKey,
        authDomain: firebaseEnv.authDomain,
        databaseURL: firebaseEnv.databaseURL,
        projectId: firebaseEnv.projectId,
        storageBucket: firebaseEnv.storageBucket,
        messagingSenderId: firebaseEnv.messagingSenderId,
        appId: firebaseEnv.appId,
      },
      APP_NAME,
    );
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const auth = getAuth(getFirebaseApp());
  if (isEmulatorEnabled()) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
      disableWarnings: true,
    });
  }
  cachedAuth = auth;
  return auth;
}

export function getFirebaseDatabase(): Database {
  if (cachedDatabase) return cachedDatabase;
  const database = getDatabase(getFirebaseApp());
  if (isEmulatorEnabled()) {
    connectDatabaseEmulator(database, EMULATOR_HOST, DATABASE_EMULATOR_PORT);
  }
  cachedDatabase = database;
  return database;
}

/** True when the SDK can be reached without throwing. */
export function canUseFirebase(): boolean {
  return isFirebaseConfigured();
}
