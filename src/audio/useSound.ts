import { useEffect, useMemo } from 'react';
import type { SoundId } from '../domain/ids';
import { useDeviceStore } from '../state/deviceStore';
import { MUSIC_BED_ID, soundManager } from './soundManager';

export interface SoundApi {
  play: (id: SoundId, options?: { volume?: number; rate?: number }) => void;
  stop: (id: SoundId) => void;
  stopAll: () => void;
}

export function useSound(): SoundApi {
  useEffect(() => {
    soundManager.install();
  }, []);

  return useMemo<SoundApi>(
    () => ({
      play: (id, options) => soundManager.play(id, options),
      stop: (id) => soundManager.stop(id),
      stopAll: () => soundManager.stopAll(),
    }),
    [],
  );
}

/** How hot the music bed should run, from the time left on a turn. */
export function intensityFromRemaining(remainingMs: number, rampMs = 6000): number {
  if (rampMs <= 0) return 0;
  const inRamp = Math.min(rampMs, Math.max(0, rampMs - remainingMs));
  return inRamp / rampMs;
}

/**
 * Looping bed whose rate and volume climb with `intensity` (0..1), so the last
 * seconds of a turn feel faster without authoring a second stem.
 */
export function useMusicBed(intensity: number, active = true): void {
  const soundEnabled = useDeviceStore((s) => s.soundEnabled);
  const level = Math.min(1, Math.max(0, intensity));

  useEffect(() => {
    soundManager.install();
  }, []);

  useEffect(() => {
    if (!active || !soundEnabled) {
      soundManager.stop(MUSIC_BED_ID);
      return;
    }
    soundManager.loop(MUSIC_BED_ID);
    return () => soundManager.stop(MUSIC_BED_ID);
  }, [active, soundEnabled]);

  useEffect(() => {
    if (!active || !soundEnabled) return;
    const base = soundManager.baseVolume(MUSIC_BED_ID);
    soundManager.setRate(MUSIC_BED_ID, 1 + level * 0.3);
    soundManager.setVolume(MUSIC_BED_ID, base * (0.8 + level * 0.5));
  }, [active, soundEnabled, level]);
}
