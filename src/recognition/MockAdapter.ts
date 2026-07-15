import type { CardSide } from '../core/types/card';
import type { PairId, SetId } from '../core/types/ids';
import type {
  AdapterStartContext,
  RecognitionAdapter,
  RecognitionEvent,
} from './types';

/**
 * Desktop/dev adapter: no computer vision. The UI renders a tappable card
 * panel and a tap calls simulateScan(), which emits the exact same events a
 * real recognizer would (found → brief track → lost). This is the seam that
 * lets the whole game flow be exercised without a camera or printed cards.
 */
export class MockAdapter implements RecognitionAdapter {
  readonly id = 'mock' as const;
  private listeners = new Set<(e: RecognitionEvent) => void>();
  private running = false;
  private seq = 0;

  async start(_ctx: AdapterStartContext): Promise<void> {
    this.running = true;
  }

  stop(): void {
    this.running = false;
    this.listeners.clear();
  }

  onEvent(cb: (e: RecognitionEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  simulateScan(setId: SetId, pairId: PairId, side: CardSide, holdMs = 2600): void {
    if (!this.running) return;
    const key = `mock:${pairId}:${side}:${this.seq++}`;
    const anchor = {
      x: 0.3 + Math.random() * 0.4,
      y: 0.35 + Math.random() * 0.3,
      size: 0.22,
    };
    this.emit({
      type: 'found',
      sighting: {
        key,
        source: 'mock',
        setId,
        pairId,
        side,
        anchor,
        confidence: 1,
        at: Date.now(),
      },
    });
    setTimeout(() => this.emit({ type: 'lost', key }), holdMs);
  }

  private emit(e: RecognitionEvent): void {
    this.listeners.forEach((cb) => cb(e));
  }
}
