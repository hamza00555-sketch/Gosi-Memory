import type { CardRecognitionAdapter, ScanResult } from './types';

/**
 * Default MVP adapter: there is no computer vision. The UI renders a tappable
 * card grid over the camera HUD, and a tap calls simulateScan(cardId), which
 * emits a ScanResult exactly as a real recognizer would. This is the seam where
 * MindAR plugs in later.
 */
export class MockCardRecognitionAdapter implements CardRecognitionAdapter {
  readonly id = 'mock';
  readonly capabilities = { realCamera: false, realRecognition: false };
  private listeners = new Set<(r: ScanResult) => void>();
  private running = false;

  async start(): Promise<void> {
    this.running = true;
  }

  stop(): void {
    this.running = false;
    this.listeners.clear();
  }

  onScan(cb: (result: ScanResult) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  simulateScan(cardId: string): void {
    if (!this.running) return;
    const result: ScanResult = { cardId, confidence: 1, at: Date.now() };
    this.listeners.forEach((cb) => cb(result));
  }
}
