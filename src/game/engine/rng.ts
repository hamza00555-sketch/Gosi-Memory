/**
 * Seeded PRNG (mulberry32). Every derived choice — puzzle piece order,
 * challenge payloads, which puzzle a team receives — runs through this so the
 * host, a reconnecting device and a test all reconstruct identical state from
 * the same seed. Never use Math.random in the engine.
 */
export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * Math.max(1, maxExclusive)),
  };
}

/** Pure Fisher-Yates; the input array is never mutated. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Derive an independent, reproducible sub-seed for one moment in the match. */
export function deriveSeed(seed: number, ...parts: number[]): number {
  let h = seed >>> 0;
  for (const part of parts) {
    h = (Math.imul(h ^ (part >>> 0), 0x01000193) + 0x9e3779b9) >>> 0;
  }
  return h >>> 0;
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] ?? 1) >>> 0;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
