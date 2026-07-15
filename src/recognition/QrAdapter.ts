import { decodeQrPayload } from '../lib/sets';
import type {
  AdapterStartContext,
  RecognitionAdapter,
  RecognitionEvent,
} from './types';

interface DetectedCode {
  text: string;
  /** Center + width in source-canvas pixel coords. */
  cx: number;
  cy: number;
  width: number;
}

/** Minimal typing for the native BarcodeDetector (Android Chrome). */
interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<
    Array<{ rawValue: string; cornerPoints: Array<{ x: number; y: number }> }>
  >;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => NativeBarcodeDetector;
  }
}

const SCAN_INTERVAL_MS = 140;
/** A code unseen for this long is considered lost (physical card flipped back). */
const LOST_AFTER_MS = 900;
/** Downscale target — QR detection needs contrast, not resolution (perf trap). */
const MAX_SCAN_WIDTH = 640;
/** jsQR finds one code per pass; mask found codes and re-scan to catch more. */
const MAX_CODES_PER_FRAME = 3;

/**
 * QR recognition over the live camera feed. This is the guaranteed-fallback
 * path of the hybrid recognizer: every printed card carries a small corner QR
 * (`gosi1:<setId>:<pairId>:<a|b>`), so identity works even when image tracking
 * can't (bad light, damaged art, weak device).
 *
 * Uses the native BarcodeDetector when available (detects many codes at once),
 * otherwise jsQR on a downscaled canvas with iterative masking.
 */
export class QrAdapter implements RecognitionAdapter {
  readonly id = 'qr' as const;
  private listeners = new Set<(e: RecognitionEvent) => void>();
  private video: HTMLVideoElement | null = null;
  private canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private detector: NativeBarcodeDetector | null = null;
  private jsqr: typeof import('jsqr').default | null = null;
  /** payload text -> { key, lastSeen } for active tracks. */
  private active = new Map<string, { key: string; lastSeen: number }>();
  private seq = 0;
  private busy = false;

  async start(ctx: AdapterStartContext): Promise<void> {
    this.video = ctx.video;
    if (typeof window !== 'undefined' && window.BarcodeDetector) {
      try {
        this.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        this.detector = null;
      }
    }
    if (!this.detector) {
      this.jsqr = (await import('jsqr')).default;
    }
    this.timer = setInterval(() => void this.scanFrame(), SCAN_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const track of this.active.values()) {
      this.emit({ type: 'lost', key: track.key });
    }
    this.active.clear();
    this.listeners.clear();
    this.video = null;
  }

  onEvent(cb: (e: RecognitionEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private async scanFrame(): Promise<void> {
    const video = this.video;
    const canvas = this.canvas;
    if (!video || !canvas || this.busy) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;
    this.busy = true;
    try {
      const scale = Math.min(1, MAX_SCAN_WIDTH / video.videoWidth);
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const g = canvas.getContext('2d', { willReadFrequently: true });
      if (!g) return;
      g.drawImage(video, 0, 0, w, h);

      const codes = this.detector
        ? await this.detectNative(canvas)
        : this.detectJsqr(g, w, h);

      const now = Date.now();
      for (const code of codes) this.handleCode(code, w, now);
      this.expireLost(now);
    } catch {
      // A single bad frame must never kill the scan loop.
    } finally {
      this.busy = false;
    }
  }

  private async detectNative(canvas: HTMLCanvasElement): Promise<DetectedCode[]> {
    const results = await this.detector!.detect(canvas);
    return results.map((r) => {
      const xs = r.cornerPoints.map((p) => p.x);
      const ys = r.cornerPoints.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        text: r.rawValue,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        width: maxX - minX,
      };
    });
  }

  private detectJsqr(
    g: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): DetectedCode[] {
    if (!this.jsqr) return [];
    const found: DetectedCode[] = [];
    // jsQR returns a single code; mask it out and re-scan to find neighbours
    // (two cards face-up = two codes in frame).
    for (let i = 0; i < MAX_CODES_PER_FRAME; i++) {
      const image = g.getImageData(0, 0, w, h);
      const code = this.jsqr(image.data, w, h, { inversionAttempts: 'dontInvert' });
      if (!code || !code.data) break;
      const { topLeftCorner: tl, topRightCorner: tr, bottomLeftCorner: bl, bottomRightCorner: br } =
        code.location;
      const xs = [tl.x, tr.x, bl.x, br.x];
      const ys = [tl.y, tr.y, bl.y, br.y];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      found.push({
        text: code.data,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        width: maxX - minX,
      });
      // Paint over the detected code so the next pass finds a different one.
      g.fillStyle = '#808080';
      g.fillRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
    }
    return found;
  }

  private handleCode(code: DetectedCode, frameWidth: number, now: number): void {
    const payload = decodeQrPayload(code.text);
    if (!payload) return; // foreign QR — ignore silently

    const frameHeight = this.canvas!.height;
    const transform = {
      anchor: {
        x: code.cx / frameWidth,
        y: code.cy / frameHeight,
        size: code.width / frameWidth,
      },
    };

    const existing = this.active.get(code.text);
    if (existing) {
      existing.lastSeen = now;
      this.emit({ type: 'update', key: existing.key, transform });
      return;
    }

    const key = `qr:${code.text}:${this.seq++}`;
    this.active.set(code.text, { key, lastSeen: now });
    this.emit({
      type: 'found',
      sighting: {
        key,
        source: 'qr',
        setId: payload.setId,
        pairId: payload.pairId,
        side: payload.side,
        ...transform,
        confidence: 1,
        at: now,
      },
    });
  }

  private expireLost(now: number): void {
    for (const [text, track] of this.active) {
      if (now - track.lastSeen > LOST_AFTER_MS) {
        this.active.delete(text);
        this.emit({ type: 'lost', key: track.key });
      }
    }
  }

  private emit(e: RecognitionEvent): void {
    this.listeners.forEach((cb) => cb(e));
  }
}
