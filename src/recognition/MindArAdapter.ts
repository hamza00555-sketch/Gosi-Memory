import type { CardSet } from '../lib/sets';
import { pairByTargetIndex, setAssetUrl } from '../lib/sets';
import { loadLocalMindTargets } from '../lib/mindStore';
import type {
  AdapterStartContext,
  RecognitionAdapter,
  RecognitionEvent,
} from './types';

/**
 * Reference-image recognition: MindAR image tracking over the set's compiled
 * `.mind` targets file (the "reference image library" — every card face is a
 * target). This is the pretty path of the hybrid recognizer: it yields a real
 * 6-DoF pose so AR objects stick to the physical card.
 *
 * Deliberately a thin bridge over MindAR's `Controller` core — NOT the
 * MindARThree wrapper, which depends on a three.js API that no longer exists
 * (sRGBEncoding). Same approach and math as the proven Holoform bridge.
 *
 * Limits baked into the design:
 * - maxTrack=2: exactly the two face-up cards a memory turn needs. More would
 *   starve the GPU (TF.js shares it with rendering).
 * - Identical pair faces = one target: the tracker cannot distinguish side
 *   a/b, so sightings carry side=null and the FusionResolver assigns one.
 */
export class MindArAdapter implements RecognitionAdapter {
  readonly id = 'image' as const;
  private listeners = new Set<(e: RecognitionEvent) => void>();
  private controller: import('mind-ar/dist/mindar-image.prod.js').Controller | null = null;
  private set: CardSet;
  /** targetIndex -> live track key (null when not showing). */
  private activeKeys = new Map<number, string>();
  private seq = 0;
  private dimensions: Array<[number, number]> = [];
  private projectionMatrix: number[] | null = null;

  constructor(set: CardSet) {
    this.set = set;
  }

  /** Exposed for the AR stage: camera projection + per-target card sizes. */
  getProjectionMatrix(): number[] | null {
    return this.projectionMatrix;
  }
  getTargetDimensions(targetIndex: number): [number, number] | null {
    return this.dimensions[targetIndex] ?? null;
  }

  async start(ctx: AdapterStartContext): Promise<void> {
    const buffer = await this.loadTargetsBuffer();

    const { Controller } = await import('mind-ar/dist/mindar-image.prod.js');
    const video = ctx.video;
    this.controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: 2,
      // Slightly forgiving filter: printed cards on a table barely move.
      filterMinCF: 0.0005,
      filterBeta: 0.002,
      onUpdate: (data) => {
        if (data.type !== 'updateMatrix' || data.targetIndex === undefined) return;
        this.handleTargetUpdate(data.targetIndex, data.worldMatrix ?? null);
      },
    });

    const result = this.controller.addImageTargetsFromBuffer(buffer);
    this.dimensions = result?.dimensions ?? this.controller.markerDimensions ?? [];
    this.projectionMatrix = this.controller.getProjectionMatrix();

    await this.controller.dummyRun(video);
    this.controller.processVideo(video);
  }

  stop(): void {
    try {
      this.controller?.stopProcessVideo();
      this.controller?.dispose();
    } catch {
      // Disposal races with in-flight worker frames; never let it throw.
    }
    this.controller = null;
    for (const key of this.activeKeys.values()) {
      this.emit({ type: 'lost', key });
    }
    this.activeKeys.clear();
    this.listeners.clear();
  }

  onEvent(cb: (e: RecognitionEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Local (freshly compiled, IndexedDB) targets win over the shipped file. */
  private async loadTargetsBuffer(): Promise<ArrayBuffer> {
    const local = await loadLocalMindTargets(this.set.setId);
    if (local) return local;
    if (!this.set.mindFile) {
      throw new Error(`Set ${this.set.setId} has no compiled .mind targets`);
    }
    const res = await fetch(setAssetUrl(this.set.setId, this.set.mindFile));
    if (!res.ok) throw new Error(`targets fetch failed: HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  private handleTargetUpdate(targetIndex: number, worldMatrix: number[] | null): void {
    const existingKey = this.activeKeys.get(targetIndex);

    if (worldMatrix === null) {
      if (existingKey) {
        this.activeKeys.delete(targetIndex);
        this.emit({ type: 'lost', key: existingKey });
      }
      return;
    }

    if (existingKey) {
      this.emit({ type: 'update', key: existingKey, transform: { worldMatrix } });
      return;
    }

    const pair = pairByTargetIndex(this.set, targetIndex);
    if (!pair) return; // stale .mind vs set.json — ignore unknown targets

    const key = `image:${targetIndex}:${this.seq++}`;
    this.activeKeys.set(targetIndex, key);
    this.emit({
      type: 'found',
      sighting: {
        key,
        source: 'image',
        setId: this.set.setId,
        pairId: pair.pairId,
        side: null, // identical faces — resolver assigns a side
        targetIndex,
        worldMatrix,
        confidence: 0.9,
        at: Date.now(),
      },
    });
  }

  private emit(e: RecognitionEvent): void {
    this.listeners.forEach((cb) => cb(e));
  }
}
