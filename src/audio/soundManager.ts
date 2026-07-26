import { SOUNDS } from '../content';
import type { SoundDefinition } from '../content';
import type { SoundId } from '../domain/ids';
import { useDeviceStore } from '../state/deviceStore';

/**
 * Sound is a courtesy, never a dependency.
 *
 * Not one of the mp3s exists yet, and a party game must not fill the console
 * with failures or reject a promise into a render path because of it: every
 * miss is recorded once and then treated as silence for the rest of the
 * session.
 */

const POOL_SIZE = 2;
const MUSIC_BED_ID: SoundId = 'music_bed';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Every media call below can throw synchronously in a hostile environment. */
function attempt(fn: () => void): void {
  try {
    fn();
  } catch {
    /* deliberately silent */
  }
}

class SoundManager {
  private readonly defs = new Map<SoundId, SoundDefinition>(SOUNDS.map((s) => [s.id, s]));
  private readonly pools = new Map<SoundId, HTMLAudioElement[]>();
  private readonly broken = new Set<SoundId>();
  private unlocked = false;
  private listening = false;

  /** Attach the one-shot gesture listeners iOS needs before any audio plays. */
  install(): void {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;
    const options = { once: true, passive: true } as const;
    window.addEventListener('pointerdown', this.onGesture, options);
    window.addEventListener('touchend', this.onGesture, options);
    window.addEventListener('keydown', this.onGesture, options);
  }

  private readonly onGesture = (): void => {
    this.unlock();
  };

  /**
   * iOS gates playback per element, so every element a match might need is
   * created and nudged inside the gesture that unlocked audio.
   */
  unlock(): void {
    if (this.unlocked || typeof window === 'undefined') return;
    this.unlocked = true;
    for (const def of SOUNDS) {
      for (const el of this.pool(def.id)) this.prime(el);
    }
  }

  private prime(el: HTMLAudioElement): void {
    const restore = el.volume;
    el.muted = true;
    attempt(() => {
      void el
        .play()
        .then(() => {
          attempt(() => {
            el.pause();
            el.currentTime = 0;
            el.muted = false;
            el.volume = restore;
          });
        })
        .catch(() => {
          el.muted = false;
        });
    });
  }

  private enabled(): boolean {
    return useDeviceStore.getState().soundEnabled;
  }

  private pool(id: SoundId): HTMLAudioElement[] {
    const existing = this.pools.get(id);
    if (existing) return existing;

    const def = this.defs.get(id);
    if (!def || typeof window === 'undefined' || typeof Audio === 'undefined') return [];

    const size = def.loop ? 1 : POOL_SIZE;
    const created: HTMLAudioElement[] = [];
    for (let i = 0; i < size; i += 1) {
      const el = new Audio();
      el.preload = 'auto';
      el.loop = def.loop;
      el.volume = def.volume;
      // A missing file resolves to a 404 here; mark it and stay quiet forever.
      el.addEventListener('error', () => this.broken.add(id), { once: true });
      el.src = def.src;
      created.push(el);
    }
    this.pools.set(id, created);
    return created;
  }

  private free(id: SoundId): HTMLAudioElement | null {
    const pool = this.pool(id);
    if (pool.length === 0) return null;
    return pool.find((el) => el.paused || el.ended) ?? pool[0] ?? null;
  }

  play(id: SoundId, options: { volume?: number; rate?: number } = {}): void {
    if (!this.enabled() || this.broken.has(id)) return;
    const def = this.defs.get(id);
    if (!def) return;

    const el = this.free(id);
    if (!el) return;

    attempt(() => {
      el.volume = clamp01(options.volume ?? def.volume);
      el.playbackRate = options.rate ?? 1;
      el.currentTime = 0;
      void el.play().catch(() => undefined);
    });
  }

  /** Start (or leave running) a looping bed. */
  loop(id: SoundId): void {
    if (!this.enabled() || this.broken.has(id)) return;
    const el = this.free(id);
    if (!el || !el.paused) return;
    attempt(() => {
      el.loop = true;
      void el.play().catch(() => undefined);
    });
  }

  setVolume(id: SoundId, volume: number): void {
    for (const el of this.pools.get(id) ?? []) attempt(() => (el.volume = clamp01(volume)));
  }

  setRate(id: SoundId, rate: number): void {
    for (const el of this.pools.get(id) ?? []) {
      attempt(() => (el.playbackRate = Math.min(2, Math.max(0.5, rate))));
    }
  }

  stop(id: SoundId): void {
    for (const el of this.pools.get(id) ?? []) {
      attempt(() => {
        el.pause();
        el.currentTime = 0;
      });
    }
  }

  stopAll(): void {
    for (const id of this.pools.keys()) this.stop(id);
  }

  /** The default volume authored for a sound, before any ramp. */
  baseVolume(id: SoundId): number {
    return this.defs.get(id)?.volume ?? 1;
  }
}

export const soundManager = new SoundManager();
export { MUSIC_BED_ID };

if (typeof window !== 'undefined') {
  // Muting is expected to take effect immediately, mid-sound.
  useDeviceStore.subscribe((state) => {
    if (!state.soundEnabled) soundManager.stopAll();
  });
}
