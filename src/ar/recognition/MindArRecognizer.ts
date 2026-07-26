import type { MindArMatrix, MindArUpdateEvent } from 'mind-ar/dist/mindar-image.prod.js';
import { getTargetById, getTargetByIndex, MIND_FILE_URL } from '../../content';
import type { TargetId } from '../../domain/ids';
import { AR_TUNING } from '../arConfig';
import { loadMindFile } from '../loaders/targetLibrary';
import type {
  CardRecognizer,
  RecognitionEvent,
  RecognitionListener,
  TargetSighting,
  Unsubscribe,
} from './types';

/** Minimal structural view of the headless controller, so the import stays lazy. */
interface HeadlessController {
  addImageTargets(url: string): Promise<{ dimensions: Array<[number, number]> }>;
  addImageTargetsFromBuffer(buffer: ArrayBuffer): { dimensions: Array<[number, number]> };
  dummyRun(video: HTMLVideoElement): void;
  processVideo(video: HTMLVideoElement): void;
  stopProcessVideo(): void;
  getProjectionMatrix(): MindArMatrix;
  dispose(): void;
}

interface TrackState {
  /** MindAR is currently reporting a matrix for this target. */
  tracked: boolean;
  /** A 'found' has been emitted and no grace window has expired since. */
  announced: boolean;
  lastSeenAt: number;
  lastMatrix: number[] | null;
  graceTimer: number | null;
}

export interface MindArRecognizerOptions {
  /** Overrides MIND_FILE_URL. Only used by tooling and tests. */
  mindFileUrl?: string;
  maxTrack?: number;
  /** Injected clock, so the derived confidence curve is testable. */
  now?: () => number;
}

/** Column-major 4x4 multiply: out = a * b. */
function multiplyMat4(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += (a[k * 4 + row] ?? 0) * (b[col * 4 + k] ?? 0);
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/**
 * MindAR reports a matrix in target-image pixel space with the origin at the
 * image's top-left. Baking in this post-matrix here means the rendering layer
 * receives a matrix in card space — origin at the card centre, 1 unit = card
 * width — so an object set can be authored once and fit any print size.
 */
function cardSpacePostMatrix(width: number, height: number): number[] {
  return [
    width, 0, 0, 0,
    0, width, 0, 0,
    0, 0, width, 0,
    width / 2, height / 2, 0, 1,
  ];
}

export class MindArRecognizer implements CardRecognizer {
  readonly kind = 'mindar' as const;

  private readonly mindFileUrl: string;
  private readonly maxTrack: number;
  private readonly now: () => number;

  private readonly listeners = new Set<RecognitionListener>();
  private readonly states = new Map<number, TrackState>();
  private readonly postMatrices = new Map<number, number[]>();
  private readonly warnedIndices = new Set<number>();

  private controller: HeadlessController | null = null;
  private running = false;
  private starting: Promise<void> | null = null;

  constructor(options: MindArRecognizerOptions = {}) {
    this.mindFileUrl = options.mindFileUrl ?? MIND_FILE_URL;
    this.maxTrack = options.maxTrack ?? AR_TUNING.controller.maxTrack;
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
    if (!this.controller) return null;
    return [...this.controller.getProjectionMatrix()];
  }

  /**
   * Never throws. A missing .mind file, a denied GPU context or a corrupt
   * target pack all surface as an 'error' event and leave isRunning false —
   * the AR screen must degrade to "no targets" rather than crash the match.
   */
  async start(video: HTMLVideoElement): Promise<void> {
    if (this.running) return;
    if (this.starting) return this.starting;
    this.starting = this.startInternal(video).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async startInternal(video: HTMLVideoElement): Promise<void> {
    const inputWidth = video.videoWidth;
    const inputHeight = video.videoHeight;
    if (inputWidth <= 0 || inputHeight <= 0) {
      this.emit({ type: 'error', message: 'video has no dimensions yet' });
      return;
    }

    try {
      // Lazy so the tfjs-backed controller (several MB) never lands in the
      // initial chunk — the lobby must boot without it.
      const { Controller } = await import('mind-ar/dist/mindar-image.prod.js');

      const controller = new Controller({
        inputWidth,
        inputHeight,
        maxTrack: this.maxTrack,
        warmupTolerance: AR_TUNING.controller.warmupTolerance,
        missTolerance: AR_TUNING.controller.missTolerance,
        filterMinCF: AR_TUNING.controller.filterMinCF,
        filterBeta: AR_TUNING.controller.filterBeta,
        onUpdate: (event: MindArUpdateEvent) => {
          this.handleUpdate(event);
        },
      }) as unknown as HeadlessController;

      const buffer = await loadMindFile(this.mindFileUrl);
      const { dimensions } = buffer
        ? controller.addImageTargetsFromBuffer(buffer)
        : await controller.addImageTargets(this.mindFileUrl);

      dimensions.forEach((dimension, index) => {
        const [width, height] = dimension;
        this.postMatrices.set(index, cardSpacePostMatrix(width, height));
      });

      controller.dummyRun(video);
      controller.processVideo(video);

      this.controller = controller;
      this.running = true;
      this.emit({ type: 'ready', targetCount: dimensions.length });
    } catch (error) {
      this.teardown();
      this.emit({
        type: 'error',
        message: error instanceof Error ? error.message : 'failed to start MindAR',
      });
    }
  }

  stop(): void {
    if (this.controller) {
      const controller = this.controller;
      this.controller = null;
      try {
        controller.stopProcessVideo();
        controller.dispose();
      } catch {
        // A controller that never finished warming up may not have a worker.
      }
    }
    this.teardown();
  }

  private teardown(): void {
    this.running = false;
    for (const state of this.states.values()) {
      if (state.graceTimer !== null) window.clearTimeout(state.graceTimer);
    }
    this.states.clear();
    this.postMatrices.clear();
  }

  /**
   * Derived confidence. MindAR exposes no scalar score, so we synthesise the
   * only signal that is actually meaningful downstream: a target the tracker is
   * currently locked onto is fully trusted, and one it has just dropped decays
   * linearly to zero across the grace window instead of falling off a cliff.
   */
  getConfidence(targetId: TargetId, now: number = this.now()): number {
    const entry = getTargetById(targetId);
    if (!entry) return 0;
    const state = this.states.get(entry.targetIndex);
    if (!state) return 0;
    return confidenceOf(state, now);
  }

  private handleUpdate(event: MindArUpdateEvent): void {
    if (event.type !== 'updateMatrix') return;

    const targetIndex = event.targetIndex;
    if (typeof targetIndex !== 'number') return;

    const entry = getTargetByIndex(targetIndex);
    if (!entry) {
      // A .mind file compiled from more images than the manifest lists. Drop it
      // loudly but keep tracking everything else — a stale target pack must not
      // take the match down.
      if (!this.warnedIndices.has(targetIndex)) {
        this.warnedIndices.add(targetIndex);
        console.warn(
          `[ar] targetIndex ${targetIndex} is not in targets-manifest.json; ignoring. ` +
            'Recompile the .mind file — see docs/AR-TARGETS.md.',
        );
      }
      return;
    }

    const now = this.now();
    const state = this.stateFor(targetIndex);
    const rawMatrix = event.worldMatrix ?? null;

    if (rawMatrix) {
      const post = this.postMatrices.get(targetIndex);
      const worldMatrix = post ? multiplyMat4(rawMatrix, post) : [...rawMatrix];

      if (state.graceTimer !== null) {
        window.clearTimeout(state.graceTimer);
        state.graceTimer = null;
      }

      const wasAnnounced = state.announced;
      state.tracked = true;
      state.announced = true;
      state.lastSeenAt = now;
      state.lastMatrix = worldMatrix;

      const sighting: TargetSighting = {
        targetIndex,
        targetId: entry.targetId,
        pairId: entry.pairId,
        confidence: 1,
        worldMatrix,
        at: now,
      };
      this.emit({ type: wasAnnounced ? 'updated' : 'found', sighting });
      return;
    }

    if (!state.announced) return;

    state.tracked = false;
    state.lastSeenAt = now;

    // The target stays "announced" for the grace window: if it comes back
    // inside it, the next event is an 'updated' and the scan gate's stability
    // streak survives the flicker. After the window it is a fresh 'found'.
    if (state.graceTimer !== null) window.clearTimeout(state.graceTimer);
    state.graceTimer = window.setTimeout(() => {
      state.graceTimer = null;
      state.announced = false;
      state.lastMatrix = null;
    }, AR_TUNING.trackingGraceMs);

    this.emit({
      type: 'lost',
      sighting: {
        targetIndex,
        targetId: entry.targetId,
        pairId: entry.pairId,
        confidence: 0,
        worldMatrix: null,
        at: now,
      },
    });
  }

  private stateFor(targetIndex: number): TrackState {
    const existing = this.states.get(targetIndex);
    if (existing) return existing;
    const created: TrackState = {
      tracked: false,
      announced: false,
      lastSeenAt: 0,
      lastMatrix: null,
      graceTimer: null,
    };
    this.states.set(targetIndex, created);
    return created;
  }

  private emit(event: RecognitionEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error('[ar] recognition listener threw', error);
      }
    }
  }
}

function confidenceOf(state: TrackState, now: number): number {
  if (state.tracked) return 1;
  if (!state.announced) return 0;
  const elapsed = now - state.lastSeenAt;
  if (elapsed <= 0) return 1;
  return Math.max(0, 1 - elapsed / AR_TUNING.trackingGraceMs);
}
