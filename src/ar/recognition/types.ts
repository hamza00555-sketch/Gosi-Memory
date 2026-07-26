import type { PairId, TargetId } from '../../domain/ids';

/**
 * One observation of one physical card by the camera.
 *
 * A sighting is a RECOGNITION fact and nothing more. It says "this image was
 * visible", never "this card was chosen" — turning a stream of sightings into a
 * single deliberate selection is the scan gate's job, and deciding whether that
 * selection is legal is the game engine's.
 */
export interface TargetSighting {
  /** Position of the image inside the compiled .mind file. */
  targetIndex: number;
  targetId: TargetId;
  pairId: PairId;
  /** 0..1. Derived — see MindArRecognizer, MindAR reports no scalar. */
  confidence: number;
  /** Column-major 4x4 in card space (1 unit = card width, origin = centre). */
  worldMatrix: number[] | null;
  /** Timestamp of the observation, in the caller's clock domain. */
  at: number;
}

export type RecognitionEvent =
  | { type: 'found'; sighting: TargetSighting }
  | { type: 'updated'; sighting: TargetSighting }
  | { type: 'lost'; sighting: TargetSighting }
  | { type: 'ready'; targetCount: number }
  | { type: 'error'; message: string };

export type RecognitionListener = (event: RecognitionEvent) => void;

/** Unsubscribe handle returned by CardRecognizer.subscribe. */
export type Unsubscribe = () => void;

/**
 * The only surface the rest of the app is allowed to know about. Swapping
 * MindAR for a different tracker, or for the dev simulator, must require no
 * change anywhere else.
 */
export interface CardRecognizer {
  readonly kind: 'mindar' | 'simulator';
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  subscribe(cb: RecognitionListener): Unsubscribe;
  /** Column-major 4x4 OpenGL projection, or null before start() succeeds. */
  getProjectionMatrix(): number[] | null;
  readonly isRunning: boolean;
}
