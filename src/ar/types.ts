/**
 * AR abstraction. The game logic never talks to a camera or a CV library
 * directly — it consumes ScanResults from a CardRecognitionAdapter. Today the
 * MockCardRecognitionAdapter turns a tap into a scan; tomorrow a MindAR adapter
 * emits the same ScanResult from real image tracking, with zero game changes.
 */
export interface ScanResult {
  /** The card id the recognizer believes was scanned. */
  cardId: string;
  /** 0..1 confidence; mock is always 1. */
  confidence: number;
  at: number;
}

export interface AdapterCapabilities {
  realCamera: boolean;
  realRecognition: boolean;
}

export interface CardRecognitionAdapter {
  readonly id: string;
  readonly capabilities: AdapterCapabilities;
  /** Begin recognition. `video` is the live camera element when available. */
  start(video?: HTMLVideoElement | null): Promise<void>;
  stop(): void;
  /** Subscribe to scans; returns an unsubscribe function. */
  onScan(cb: (result: ScanResult) => void): () => void;
  /** Drive a scan manually (tap-to-scan in the mock; no-op for real CV). */
  simulateScan(cardId: string): void;
}
