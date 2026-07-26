import * as THREE from 'three';
import type { TargetId } from '../../domain/ids';
import type { ArObjectDefinition } from '../../domain/objectSets';
import { AR_TUNING } from '../arConfig';
import type { InstantiatedObject } from '../loaders/objectSetLoader';

type Visibility = 'hidden' | 'revealing' | 'idle' | 'grace';

/**
 * One tracked card's object, and the visibility state machine the spec calls
 * for.
 *
 * Two behaviours matter and are easy to get wrong:
 *  - Reveal plays ONCE per appearance. Tracking jitter drops a target for a
 *    frame or two constantly; replaying the entrance every time would make the
 *    object strobe.
 *  - Losing a target does not hide immediately. A grace window absorbs that
 *    same jitter, and a return inside the window resumes Idle rather than
 *    restarting.
 */
export class ObjectAnchor {
  readonly targetId: TargetId;
  readonly group: THREE.Group;

  private readonly definition: ArObjectDefinition;
  private readonly mixer: THREE.AnimationMixer | null;
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private readonly isPlaceholder: boolean;

  private visibility: Visibility = 'hidden';
  private lostAt: number | null = null;
  private revealEndsAt: number | null = null;
  private reactionEndsAt: number | null = null;
  private spinPhase = 0;

  constructor(targetId: TargetId, instance: InstantiatedObject) {
    this.targetId = targetId;
    this.definition = instance.definition;
    this.isPlaceholder = instance.isPlaceholder;

    this.group = new THREE.Group();
    this.group.name = `anchor:${targetId}`;
    // MindAR supplies the full world matrix; letting three recompute it from
    // decomposed TRS every frame would fight the tracker.
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;
    this.group.add(instance.object);

    if (instance.clips.length > 0) {
      this.mixer = new THREE.AnimationMixer(instance.object);
      for (const clip of instance.clips) this.clips.set(clip.name, clip);
    } else {
      this.mixer = null;
    }
  }

  get visible(): boolean {
    return this.group.visible;
  }

  /** Feed the tracker's matrix. Column-major, card space. */
  setMatrix(matrix: readonly number[]): void {
    if (matrix.length < 16) return;
    this.group.matrix.fromArray(matrix as number[]);
    this.group.matrixWorldNeedsUpdate = true;
  }

  /**
   * The target is in frame. Returns true when this was a genuine new
   * appearance — the caller uses that to decide whether a sound should fire.
   */
  found(now: number): boolean {
    this.lostAt = null;

    if (this.visibility === 'grace') {
      // Came back inside the window: keep going, do not replay the entrance.
      this.visibility = this.revealEndsAt !== null && now < this.revealEndsAt ? 'revealing' : 'idle';
      this.group.visible = true;
      return false;
    }
    if (this.visibility === 'revealing' || this.visibility === 'idle') return false;

    this.group.visible = true;
    this.visibility = 'revealing';
    this.revealEndsAt = now + this.playOnce(this.definition.revealClip, AR_TUNING.placeholder.revealMs);
    return true;
  }

  /** The target left the frame. Starts the grace window rather than hiding. */
  lost(now: number): void {
    if (this.visibility === 'hidden') return;
    this.lostAt = now;
    this.visibility = 'grace';
  }

  playMatch(now: number): void {
    this.reactionEndsAt =
      now + this.playOnce(this.definition.matchClip, AR_TUNING.placeholder.reactionMs);
  }

  playMismatch(now: number): void {
    this.reactionEndsAt =
      now + this.playOnce(this.definition.mismatchClip, AR_TUNING.placeholder.reactionMs);
  }

  /** Advance animation. `delta` is seconds, `now` milliseconds. */
  update(delta: number, now: number): void {
    if (this.visibility === 'grace' && this.lostAt !== null) {
      if (now - this.lostAt >= AR_TUNING.anchorGraceMs) {
        this.group.visible = false;
        this.visibility = 'hidden';
        this.lostAt = null;
        this.revealEndsAt = null;
      }
    }

    if (this.visibility === 'revealing' && this.revealEndsAt !== null && now >= this.revealEndsAt) {
      this.visibility = 'idle';
      this.playLoop(this.definition.idleClip);
    }

    if (!this.group.visible) return;

    this.mixer?.update(delta);

    // Placeholders have no authored clips, so idle motion is synthesised —
    // enough life to confirm tracking is live without pretending to be art.
    if (this.isPlaceholder) {
      this.spinPhase += delta;
      const child = this.group.children[0];
      if (child) {
        const entering =
          this.visibility === 'revealing' && this.revealEndsAt !== null
            ? Math.min(1, 1 - (this.revealEndsAt - now) / AR_TUNING.placeholder.revealMs)
            : 1;
        const reacting = this.reactionEndsAt !== null && now < this.reactionEndsAt;
        const pop = reacting ? 1 + 0.18 * Math.sin(this.spinPhase * 18) : 1;
        const eased = 1 - Math.pow(1 - Math.max(0, Math.min(1, entering)), 3);
        child.scale.setScalar(eased * pop);
        child.rotation.y = this.spinPhase * (reacting ? 3.2 : 0.9);
      }
    }
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.group.clear();
  }

  /** Returns the clip's duration in ms, or the supplied fallback. */
  private playOnce(clipName: string, fallbackMs: number): number {
    const clip = this.clips.get(clipName);
    if (!clip || !this.mixer) return fallbackMs;
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    return clip.duration * 1000;
  }

  private playLoop(clipName: string): void {
    const clip = this.clips.get(clipName);
    if (!clip || !this.mixer) return;
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.fadeIn(0.2);
    action.play();
  }
}
