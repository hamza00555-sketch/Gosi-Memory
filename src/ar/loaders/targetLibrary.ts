import { MIND_FILE_URL, TARGETS } from '../../content';

/**
 * The compiled .mind file legitimately may not exist yet — printed cards are
 * physical artwork with their own lead time, and the app has to boot, explain
 * itself and run the simulator without them. Every function here answers
 * "is it there?" rather than assuming it is, and none of them throw.
 */

let buffer: ArrayBuffer | null = null;
let availability: Promise<boolean> | null = null;
let inFlight: Promise<ArrayBuffer | null> | null = null;

export type PreloadProgress = (loaded: number, total: number) => void;

export function getMindFileUrl(): string {
  return MIND_FILE_URL;
}

/** How many images the manifest expects the .mind file to contain. */
export function expectedTargetCount(): number {
  return TARGETS.length;
}

/** HEAD probe, cached for the session. Never rejects. */
export function targetsAvailable(url: string = MIND_FILE_URL): Promise<boolean> {
  if (buffer) return Promise.resolve(true);
  availability ??= fetch(url, { method: 'HEAD' })
    .then((response) => {
      // A dev server with an SPA fallback answers 200 with index.html for a
      // missing asset, so the content type is part of the check.
      if (!response.ok) return false;
      const type = response.headers.get('content-type') ?? '';
      return !type.includes('text/html');
    })
    .catch(() => false);
  return availability;
}

/**
 * Fetches and caches the .mind bytes with byte-level progress. Resolves to null
 * when the file is absent — the caller decides whether that is fatal.
 */
export function preloadTargets(
  onProgress?: PreloadProgress,
  url: string = MIND_FILE_URL,
): Promise<ArrayBuffer | null> {
  if (buffer) {
    onProgress?.(buffer.byteLength, buffer.byteLength);
    return Promise.resolve(buffer.slice(0));
  }
  inFlight ??= fetchWithProgress(url, onProgress)
    .then((result) => {
      buffer = result;
      inFlight = null;
      return result ? result.slice(0) : null;
    })
    .catch(() => {
      inFlight = null;
      return null;
    });
  return inFlight;
}

/**
 * Returns a fresh copy of the cached bytes, or null. Used by the recognizer so
 * MindAR does not re-download a file the preloader already has.
 */
export async function loadMindFile(url: string = MIND_FILE_URL): Promise<ArrayBuffer | null> {
  if (buffer) return buffer.slice(0);
  return preloadTargets(undefined, url);
}

async function fetchWithProgress(
  url: string,
  onProgress?: PreloadProgress,
): Promise<ArrayBuffer | null> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) return null;

  const total = Number(response.headers.get('content-length') ?? 0);
  const body = response.body;

  if (!body || !onProgress) {
    const direct = await response.arrayBuffer();
    onProgress?.(direct.byteLength, total || direct.byteLength);
    return direct;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, total || loaded);
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(loaded, total || loaded);
  return merged.buffer as ArrayBuffer;
}

/** Test hook — drops the session cache. */
export function resetTargetLibrary(): void {
  buffer = null;
  availability = null;
  inFlight = null;
}
