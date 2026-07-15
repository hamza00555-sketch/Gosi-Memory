import { cardIdOf, type CardSide } from '../core/types/card';
import type { CardId, PairId, SetId } from '../core/types/ids';
import type {
  CardSighting,
  RecognitionAdapter,
  RecognitionEvent,
  ScanSource,
  SightingTransform,
} from './types';

/**
 * A live, resolved track: one physical card currently seen by some adapter,
 * with a definite cardId and its latest transform. The AR stage renders one
 * object per track; the match controller turns new tracks into FLIP actions.
 */
export interface ResolvedTrack extends SightingTransform {
  key: string;
  source: ScanSource;
  setId: SetId;
  pairId: PairId;
  side: CardSide;
  cardId: CardId;
  targetIndex?: number;
  at: number;
}

export interface FusionOptions {
  /** Only sightings from this set are accepted; others are surfaced as noise. */
  activeSetId: SetId;
  /**
   * Assign a side to an image sighting (image tracking can't tell the two
   * identical faces apart). The match controller resolves this from game
   * state: prefer the copy that is not already selected/matched.
   */
  resolveSide: (pairId: PairId) => CardSide | null;
}

/**
 * Merges the QR and image-tracking event streams into one deduplicated stream
 * of card tracks:
 *
 * - QR is authoritative for IDENTITY (it knows side a/b for certain).
 * - Image tracking is authoritative for POSE (full 6-DoF worldMatrix).
 * - The same physical card seen by both within the dedup window becomes ONE
 *   logical card: the second sighting attaches as an extra render track but
 *   does NOT fire a second onCardSeen (no double FLIP).
 */
export class FusionResolver {
  private tracks = new Map<string, ResolvedTrack>();
  private seenListeners = new Set<(t: ResolvedTrack) => void>();
  private noiseListeners = new Set<(reason: 'foreign_set') => void>();
  private unsubs: Array<() => void> = [];
  /** cardId -> last time a `found` fired for it (dedup across sources). */
  private recentlySeen = new Map<CardId, number>();
  private readonly dedupWindowMs = 1500;

  constructor(private options: FusionOptions) {}

  attach(adapter: RecognitionAdapter): void {
    this.unsubs.push(adapter.onEvent((e) => this.handleEvent(e)));
  }

  detach(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.tracks.clear();
    this.recentlySeen.clear();
  }

  /** Fired once per NEW physical-card sighting (post-dedup). Drives FLIPs. */
  onCardSeen(cb: (t: ResolvedTrack) => void): () => void {
    this.seenListeners.add(cb);
    return () => this.seenListeners.delete(cb);
  }

  /** Fired when a valid QR from a DIFFERENT set is scanned (user feedback). */
  onNoise(cb: (reason: 'foreign_set') => void): () => void {
    this.noiseListeners.add(cb);
    return () => this.noiseListeners.delete(cb);
  }

  /** Live tracks for the renderer, best transform first per card. */
  getTracks(): ResolvedTrack[] {
    const byCard = new Map<CardId, ResolvedTrack>();
    for (const track of this.tracks.values()) {
      const existing = byCard.get(track.cardId);
      // Prefer a full pose (image) over a screen anchor (qr/mock).
      if (!existing || (!existing.worldMatrix && track.worldMatrix)) {
        byCard.set(track.cardId, track);
      }
    }
    return [...byCard.values()];
  }

  private handleEvent(e: RecognitionEvent): void {
    switch (e.type) {
      case 'found':
        this.handleFound(e.sighting);
        return;
      case 'update': {
        const track = this.tracks.get(e.key);
        if (track) {
          if (e.transform.worldMatrix) track.worldMatrix = e.transform.worldMatrix;
          if (e.transform.anchor) track.anchor = e.transform.anchor;
          track.at = Date.now();
        }
        return;
      }
      case 'lost':
        this.tracks.delete(e.key);
        return;
      default: {
        const _never: never = e;
        void _never;
      }
    }
  }

  private handleFound(s: CardSighting): void {
    if (s.setId !== this.options.activeSetId) {
      this.noiseListeners.forEach((cb) => cb('foreign_set'));
      return;
    }

    const side = s.side ?? this.options.resolveSide(s.pairId);
    if (!side) return; // pair fully matched already — nothing sensible to show

    const cardId = cardIdOf(s.pairId, side);
    const track: ResolvedTrack = {
      key: s.key,
      source: s.source,
      setId: s.setId,
      pairId: s.pairId,
      side,
      cardId,
      targetIndex: s.targetIndex,
      worldMatrix: s.worldMatrix,
      anchor: s.anchor,
      at: s.at,
    };
    this.tracks.set(s.key, track);

    // Dedup: the same card reported by the other adapter moments ago is the
    // same physical flip, not a second one.
    const last = this.recentlySeen.get(cardId);
    if (last && s.at - last < this.dedupWindowMs) return;
    this.recentlySeen.set(cardId, s.at);

    this.seenListeners.forEach((cb) => cb(track));
  }
}
