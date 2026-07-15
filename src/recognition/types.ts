import type { CardSide } from '../core/types/card';
import type { PairId, SetId } from '../core/types/ids';

/**
 * The recognition abstraction. Game logic never talks to a camera or a CV
 * library directly — it consumes RecognitionEvents from adapters through the
 * FusionResolver. Adapters: QR (jsQR/BarcodeDetector), MindAR image tracking,
 * and a tap-driven Mock for desktop development.
 */

export type ScanSource = 'image' | 'qr' | 'mock';

/**
 * Where a sighting is on screen / in space.
 * - worldMatrix: full 4x4 pose from MindAR (column-major, card-width units).
 * - anchor: normalized VIDEO-frame coords for QR/mock (x,y in [0..1] from the
 *   top-left, size = marker width as a fraction of frame width).
 */
export interface SightingTransform {
  worldMatrix?: number[];
  anchor?: { x: number; y: number; size: number };
}

export interface CardSighting extends SightingTransform {
  /** Stable per-tracking-session key, unique per adapter. */
  key: string;
  source: ScanSource;
  setId: SetId;
  pairId: PairId;
  /**
   * Which physical copy was seen. QR knows exactly; image tracking cannot
   * distinguish the two identical faces, so it reports null and the resolver
   * assigns a side from game state.
   */
  side: CardSide | null;
  targetIndex?: number;
  confidence: number;
  at: number;
}

export type RecognitionEvent =
  | { type: 'found'; sighting: CardSighting }
  | { type: 'update'; key: string; transform: SightingTransform }
  | { type: 'lost'; key: string };

export interface AdapterStartContext {
  video: HTMLVideoElement;
}

export interface RecognitionAdapter {
  readonly id: ScanSource;
  start(ctx: AdapterStartContext): Promise<void>;
  stop(): void;
  onEvent(cb: (e: RecognitionEvent) => void): () => void;
}
