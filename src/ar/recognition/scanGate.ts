import type { TargetId } from '../../domain/ids';
import { RULES } from '../../game/rules/config';
import { AR_TUNING } from '../arConfig';
import type { TargetSighting } from './types';

/**
 * Why a sighting did or did not become a selection. Every rejection is named so
 * the HUD can say something true ("ثبّت البطاقة") instead of silently ignoring
 * the player.
 */
export type ScanVerdict =
  | 'accepted'
  | 'rejected_confidence'
  | 'rejected_unstable'
  | 'rejected_debounce'
  | 'rejected_cooldown'
  | 'rejected_not_selectable';

export type SelectablePredicate = (targetId: TargetId) => boolean;

export interface ScanGateOptions {
  /** Defaults to RULES.minScanConfidence — the shared floor with the engine. */
  minConfidence?: number;
  stableFrames?: number;
  debounceMs?: number;
  cooldownMs?: number;
  /**
   * The rules decide what may be picked; the gate never asks why. Defaults to
   * "everything", so a gate constructed without one is permissive rather than
   * mysteriously dead.
   */
  isSelectable?: SelectablePredicate;
}

/**
 * Turns a noisy stream of sightings into at most one deliberate selection.
 *
 * Pure and framework-free: no clock, no timers, no DOM. `feed` is given the
 * timestamp it should reason about, which is what makes the debounce and
 * cooldown windows exhaustively unit-testable.
 */
export class ScanGate {
  readonly minConfidence: number;
  readonly stableFrames: number;
  readonly debounceMs: number;
  readonly cooldownMs: number;

  private selectable: SelectablePredicate;
  private readonly streaks = new Map<TargetId, number>();
  private readonly acceptedAt = new Map<TargetId, number>();
  private lastAcceptedAt: number | null = null;

  constructor(options: ScanGateOptions = {}) {
    this.minConfidence = options.minConfidence ?? RULES.minScanConfidence;
    this.stableFrames = Math.max(1, options.stableFrames ?? AR_TUNING.scanGate.stableFrames);
    this.debounceMs = options.debounceMs ?? AR_TUNING.scanGate.debounceMs;
    this.cooldownMs = options.cooldownMs ?? AR_TUNING.scanGate.cooldownMs;
    this.selectable = options.isSelectable ?? (() => true);
  }

  /** Swap the predicate when the turn changes, without dropping streak state. */
  setSelectable(predicate: SelectablePredicate): void {
    this.selectable = predicate;
  }

  /**
   * Checks run cheapest-and-most-specific first, so the returned verdict is the
   * most informative reason rather than merely the first failing one.
   */
  feed(sighting: TargetSighting, now: number = sighting.at): ScanVerdict {
    const { targetId } = sighting;

    if (sighting.confidence < this.minConfidence) {
      // A degraded frame breaks the run: "four consecutive good frames" must
      // mean four in a row, not four spread across a second of flicker.
      this.streaks.delete(targetId);
      return 'rejected_confidence';
    }

    const streak = (this.streaks.get(targetId) ?? 0) + 1;
    this.streaks.set(targetId, streak);
    if (streak < this.stableFrames) return 'rejected_unstable';

    if (!this.selectable(targetId)) return 'rejected_not_selectable';

    const previous = this.acceptedAt.get(targetId);
    if (previous !== undefined && now - previous < this.debounceMs) {
      return 'rejected_debounce';
    }

    if (this.lastAcceptedAt !== null && now - this.lastAcceptedAt < this.cooldownMs) {
      return 'rejected_cooldown';
    }

    this.acceptedAt.set(targetId, now);
    this.lastAcceptedAt = now;
    // Force a fresh run of stable frames before this card can fire again.
    this.streaks.delete(targetId);
    return 'accepted';
  }

  /** Called when a target is lost: its run of consecutive frames has ended. */
  forget(targetId: TargetId): void {
    this.streaks.delete(targetId);
  }

  /** Full clear — new turn, new round, or the AR stage restarting. */
  reset(): void {
    this.streaks.clear();
    this.acceptedAt.clear();
    this.lastAcceptedAt = null;
  }

  /** Introspection for tests and the debug HUD. */
  streakOf(targetId: TargetId): number {
    return this.streaks.get(targetId) ?? 0;
  }

  cooldownRemaining(now: number): number {
    if (this.lastAcceptedAt === null) return 0;
    return Math.max(0, this.cooldownMs - (now - this.lastAcceptedAt));
  }
}
