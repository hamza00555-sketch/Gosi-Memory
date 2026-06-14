import type { CardRecognitionAdapter, ScanResult } from './types';

/**
 * Placeholder for the real WebAR implementation (MindAR or similar).
 *
 * Integration plan when ready:
 * 1. Add the MindAR + three.js deps and lazy-load them here (keep AR assets out
 *    of the core bundle).
 * 2. In start(video): initialize MindAR image tracking with a .mind target set
 *    built from the card faces.
 * 3. On a "targetFound" event, map the target index -> cardId and emit a
 *    ScanResult via the same listener mechanism below.
 * 4. Swap this adapter for the mock in ArProvider — no game code changes.
 *
 * It intentionally implements the interface and emits nothing yet, so it is a
 * safe, organized stand-in rather than scattered TODOs.
 */
export class FutureMindARAdapter implements CardRecognitionAdapter {
  readonly id = 'mindar';
  readonly capabilities = { realCamera: true, realRecognition: true };
  private listeners = new Set<(r: ScanResult) => void>();

  async start(_video?: HTMLVideoElement | null): Promise<void> {
    throw new Error('FutureMindARAdapter is not implemented yet. Use the mock adapter.');
  }

  stop(): void {
    this.listeners.clear();
  }

  onScan(cb: (result: ScanResult) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  simulateScan(): void {
    // Real recognition has no manual simulation path.
  }
}
