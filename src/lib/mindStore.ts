import type { SetId } from '../core/types/ids';

/**
 * Local overrides for compiled MindAR target files.
 *
 * The /tools/compile page compiles card faces into a .mind buffer in the
 * browser. Besides downloading it (to commit into the set folder), the user
 * can "install" it locally: we keep it in IndexedDB and the MindAR adapter
 * prefers it over the set's shipped file. This makes a freshly compiled set
 * playable immediately, without a redeploy.
 */

const DB_NAME = 'gosi-mind-targets';
const STORE = 'targets';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
}

export async function saveLocalMindTargets(setId: SetId, buffer: ArrayBuffer): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(buffer, setId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
  });
  db.close();
}

export async function loadLocalMindTargets(setId: SetId): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    const buffer = await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(setId);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    });
    db.close();
    return buffer;
  } catch {
    return null; // private browsing / unsupported — fall back to the shipped file
  }
}

export async function clearLocalMindTargets(setId: SetId): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(setId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
  });
  db.close();
}
