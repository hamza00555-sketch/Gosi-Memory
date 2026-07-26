import type { ObjectSetId, TargetId } from './ids';

export type Vec3 = [number, number, number];

/**
 * What is drawn over one recognized card, in one set.
 *
 * Clip names refer to animation tracks inside the GLB. They are looked up by
 * name so an artist can rename nothing and everything keeps working; a missing
 * clip is skipped rather than throwing.
 */
export type PlaceholderShape = 'prism' | 'orb' | 'ring' | 'cube';

export interface ArObjectDefinition {
  modelPath: string;
  scale: Vec3;
  position: Vec3;
  rotation: Vec3;
  revealClip: string;
  idleClip: string;
  matchClip: string;
  mismatchClip: string;
  /**
   * Drawn when modelPath cannot be fetched (no art yet, or a bad deploy). The
   * AR pipeline is then still exercised end to end — tracking, anchoring, the
   * reveal/idle state machine — with an obviously synthetic mesh, rather than
   * failing to a blank card and hiding a tracking bug behind a missing asset.
   */
  placeholderShape: PlaceholderShape;
  placeholderColor: string;
}

/**
 * A swappable visual skin over the whole card deck. Each device picks its own;
 * because sets are keyed by targetId and never consulted by the rules, two
 * devices can show completely different objects for the same physical card
 * while agreeing exactly on the match outcome.
 */
export interface ObjectSetDefinition {
  id: ObjectSetId;
  name: string;
  isDefault: boolean;
  /** Store scaffolding — no purchase flow exists yet. */
  isPurchasable: boolean;
  futurePrice: number;
  unlockSource: 'free' | 'purchase' | 'reward' | 'dev';
  previewImage: string;
  objects: Record<TargetId, ArObjectDefinition>;
}

/** Per-device, persisted locally. Ownership moves to Firebase when a store exists. */
export interface ObjectSetProfile {
  selectedObjectSetId: ObjectSetId;
  ownedObjectSetIds: ObjectSetId[];
}

export const DEFAULT_OBJECT_SET_ID = 'default_set';

/**
 * Resolve the object for a card, falling back to the default set when the chosen
 * set has no entry. A half-authored set therefore degrades to the base look
 * instead of leaving a blank card.
 */
export function resolveArObject(
  set: ObjectSetDefinition,
  defaultSet: ObjectSetDefinition,
  targetId: TargetId,
): ArObjectDefinition | null {
  return set.objects[targetId] ?? defaultSet.objects[targetId] ?? null;
}
