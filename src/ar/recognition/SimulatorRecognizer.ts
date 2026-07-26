import { getTargetById } from '../../content';
import type { TargetId } from '../../domain/ids';
import { AR_TUNING } from '../arConfig';
import type {
  CardRecognizer,
  RecognitionEvent,
  RecognitionListener,
  TargetSighting,
  Unsubscribe,
} from './types';

/**
 * import.meta.env.DEV is statically replaced at build time, so the whole
 * simulator branch is dead code a production bundle drops. The explicit opt-in
 * flag on top means it is off even in dev unless someone asks for it.
 */
export function isSimulatorEnabled(): boolean {
  return import.meta.env.DEV === true && import.meta.env.VITE_ENABLE_AR_SIMULATOR === 'true';
}

/** A card floating two units in front of the camera, upright. */
const SYNTHETIC_MATRIX: number[] = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, -2, 1,
];

/** Matches a 45-degree vertical FOV at a 3:4 portrait input. */
const SYNTHETIC_PROJECTION: number[] = [
  1.8106, 0, 0, 0,
  0, 2.4142, 0, 0,
  0, 0, -1.0002, -1,
  0, 0, -0.2, 0,
];

export interface SimulatorRecognizerOptions {
  /** How long a simulated card stays "in view" before it is lost. */
  holdMs?: number;
  /** Interval between synthetic tracking frames. */
  frameMs?: number;
  now?: () => number;
}

/**
 * Dev-only stand-in for MindAR: exercises the gate, the anchors and the whole
 * render path with no camera, no printed cards and no compiled .mind file.
 */
export class SimulatorRecognizer implements CardRecognizer {
  readonly kind = 'simulator' as const;

  private readonly listeners = new Set<RecognitionListener>();
  private readonly timers = new Set<number>();
  private readonly holdMs: number;
  private readonly frameMs: number;
  private readonly now: () => number;
  private running = false;

  constructor(options: SimulatorRecognizerOptions = {}) {
    this.holdMs = options.holdMs ?? 1600;
    this.frameMs = options.frameMs ?? 40;
    this.now = options.now ?? (() => Date.now());
  }

  get isRunning(): boolean {
    return this.running;
  }

  subscribe(cb: RecognitionListener): Unsubscribe {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getProjectionMatrix(): number[] | null {
    return this.running ? [...SYNTHETIC_PROJECTION] : null;
  }

  async start(_video: HTMLVideoElement): Promise<void> {
    if (!isSimulatorEnabled()) {
      this.emit({ type: 'error', message: 'AR simulator is disabled in this build' });
      return;
    }
    this.running = true;
    this.emit({ type: 'ready', targetCount: 0 });
  }

  stop(): void {
    this.running = false;
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
  }

  /**
   * Emits a found, enough updated frames to clear the gate's stability
   * requirement, then a lost. Returns false when the id is not a real card.
   */
  simulate(targetId: TargetId, holdMs: number = this.holdMs): boolean {
    if (!this.running) return false;
    const sighting = this.sightingFor(targetId, 1);
    if (!sighting) return false;

    this.emit({ type: 'found', sighting });

    const frames = AR_TUNING.scanGate.stableFrames + 2;
    for (let frame = 1; frame <= frames; frame += 1) {
      this.later(() => {
        const next = this.sightingFor(targetId, 1);
        if (next) this.emit({ type: 'updated', sighting: next });
      }, frame * this.frameMs);
    }

    this.later(() => this.release(targetId), Math.max(holdMs, frames * this.frameMs + 1));
    return true;
  }

  /** Ends a simulated sighting early. */
  release(targetId: TargetId): boolean {
    const sighting = this.sightingFor(targetId, 0, null);
    if (!sighting) return false;
    this.emit({ type: 'lost', sighting });
    return true;
  }

  private sightingFor(
    targetId: TargetId,
    confidence: number,
    worldMatrix: number[] | null = [...SYNTHETIC_MATRIX],
  ): TargetSighting | null {
    const entry = getTargetById(targetId);
    if (!entry) {
      console.warn(`[ar/simulator] unknown targetId "${targetId}"`);
      return null;
    }
    return {
      targetIndex: entry.targetIndex,
      targetId: entry.targetId,
      pairId: entry.pairId,
      confidence,
      worldMatrix,
      at: this.now(),
    };
  }

  private later(fn: () => void, delayMs: number): void {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      if (this.running) fn();
    }, delayMs);
    this.timers.add(timer);
  }

  private emit(event: RecognitionEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
