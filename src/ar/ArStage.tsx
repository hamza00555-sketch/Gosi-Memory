import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ObjectSetId, TargetId } from '../domain/ids';
import { ObjectSetLoader } from './loaders/objectSetLoader';
import { MindArRecognizer } from './recognition/MindArRecognizer';
import { SimulatorRecognizer, isSimulatorEnabled } from './recognition/SimulatorRecognizer';
import type { CardRecognizer, RecognitionEvent, TargetSighting } from './recognition/types';
import { ArScene } from './rendering/ArScene';

export type ArStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  /** Camera is live and the target library is loaded — scanning for real. */
  | 'tracking'
  | 'denied'
  | 'unsupported'
  | 'no_targets';

interface ArStageProps {
  objectSetId: ObjectSetId;
  /** Every observation, unfiltered. The scan gate decides what counts. */
  onSighting?: (sighting: TargetSighting) => void;
  onRecognitionEvent?: (event: RecognitionEvent) => void;
  onStatusChange?: (status: ArStatus) => void;
  /** Fires a one-shot reaction clip on a card's object. */
  reaction?: { targetId: TargetId; kind: 'match' | 'mismatch'; at: number } | null;
  children?: ReactNode;
}

/**
 * Full-bleed camera with the AR objects composited on top and the HUD above
 * that.
 *
 * The only React file in the AR layer. It wires three independent pieces —
 * recognizer, object-set loader, Three.js scene — and owns their lifetimes;
 * none of them know about each other or about the game.
 */
export function ArStage({
  objectSetId,
  onSighting,
  onRecognitionEvent,
  onStatusChange,
  reaction,
  children,
}: ArStageProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ArScene | null>(null);
  const [status, setStatus] = useState<ArStatus>('idle');

  // Callbacks are read through refs so a parent re-render never tears down the
  // camera or restarts tracking.
  const cbs = useRef({ onSighting, onRecognitionEvent, onStatusChange });
  cbs.current = { onSighting, onRecognitionEvent, onStatusChange };

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let recognizer: CardRecognizer | null = null;
    let unsubscribe: (() => void) | null = null;

    const scene = new ArScene();
    sceneRef.current = scene;
    const loader = new ObjectSetLoader(objectSetId);

    const setPhase = (next: ArStatus): void => {
      if (cancelled) return;
      setStatus(next);
      cbs.current.onStatusChange?.(next);
    };

    const onResize = (): void => scene.resize();

    const boot = async (): Promise<void> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('unsupported');
        return;
      }

      setPhase('requesting');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        setPhase('denied');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (cancelled) return;

      // Models first: an anchor that appears before its object is ready would
      // pop in a frame late on every card.
      await loader.preload();
      if (cancelled) return;

      scene.mount(canvas, loader);
      window.addEventListener('resize', onResize);
      setPhase('granted');

      recognizer = isSimulatorEnabled() ? new SimulatorRecognizer() : new MindArRecognizer();

      unsubscribe = recognizer.subscribe((event) => {
        cbs.current.onRecognitionEvent?.(event);
        const now = performance.now();

        switch (event.type) {
          case 'found':
          case 'updated':
            scene.upsertAnchor(event.sighting.targetId, event.sighting.worldMatrix, now);
            scene.setProjectionMatrix(recognizer?.getProjectionMatrix() ?? null);
            cbs.current.onSighting?.(event.sighting);
            break;
          case 'lost':
            scene.loseAnchor(event.sighting.targetId, now);
            break;
          case 'error':
            console.warn('[ar] recognition error:', event.message);
            setPhase('no_targets');
            break;
          case 'ready':
            setPhase('tracking');
            break;
          default:
            break;
        }
      });

      try {
        await recognizer.start(video);
        scene.setProjectionMatrix(recognizer.getProjectionMatrix());
      } catch {
        // The compiled .mind library is genuinely optional in a fresh checkout;
        // the camera still runs so the rest of the match is playable.
        setPhase('no_targets');
      }
    };

    void boot();

    return () => {
      cancelled = true;
      unsubscribe?.();
      recognizer?.stop();
      window.removeEventListener('resize', onResize);
      scene.dispose();
      loader.dispose();
      sceneRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [objectSetId]);

  useEffect(() => {
    if (!reaction) return;
    sceneRef.current?.playReaction(reaction.targetId, reaction.kind, performance.now());
  }, [reaction]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* A plain dark field until the camera is live, so the HUD is legible
          from the first frame instead of flashing over white. */}
      {status !== 'granted' && status !== 'tracking' && (
        <div className="absolute inset-0 bg-gradient-to-b from-ink-900 via-ink-950 to-ink-900" />
      )}

      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

export default ArStage;
