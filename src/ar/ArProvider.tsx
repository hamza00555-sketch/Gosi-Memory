import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MockCardRecognitionAdapter } from './MockCardRecognitionAdapter';
import type { CardRecognitionAdapter } from './types';

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported';

interface ArContextValue {
  adapter: CardRecognitionAdapter;
  cameraStatus: CameraStatus;
  /** Attach the live camera stream to a <video>; falls back gracefully. */
  attachVideo: (video: HTMLVideoElement) => Promise<void>;
  detach: () => void;
}

const ArContext = createContext<ArContextValue | null>(null);

interface ArProviderProps {
  children: ReactNode;
  /** Inject a different adapter (e.g. FutureMindARAdapter) for testing/rollout. */
  adapter?: CardRecognitionAdapter;
}

/**
 * Owns the recognition adapter and the camera lifecycle so screens stay clean.
 * Defaults to the mock adapter; the camera feed is optional eye-candy — if the
 * user denies permission the HUD still works with a styled fallback background.
 */
export function ArProvider({ children, adapter }: ArProviderProps): JSX.Element {
  const adapterRef = useRef<CardRecognitionAdapter>(adapter ?? new MockCardRecognitionAdapter());
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');

  const attachVideo = useCallback(async (video: HTMLVideoElement) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      return;
    }
    try {
      setCameraStatus('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setCameraStatus('granted');
    } catch {
      setCameraStatus('denied');
    }
  }, []);

  const detach = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const value = useMemo<ArContextValue>(
    () => ({ adapter: adapterRef.current, cameraStatus, attachVideo, detach }),
    [cameraStatus, attachVideo, detach],
  );

  return <ArContext.Provider value={value}>{children}</ArContext.Provider>;
}

export function useAr(): ArContextValue {
  const ctx = useContext(ArContext);
  if (!ctx) throw new Error('useAr must be used within <ArProvider>');
  return ctx;
}
