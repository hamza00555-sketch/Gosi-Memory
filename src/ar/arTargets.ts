/**
 * AR target registry.
 *
 * Each entry maps a physical card image (the .mind target) to:
 *  - a cardId / pairId in the game deck
 *  - an arObjectId to spawn when the target is found
 *
 * targetIndex must match the order the images were compiled into cards.mind.
 * Today only one real image exists; the rest will be added when physical cards
 * are printed and compiled into a new target set.
 */

export interface ArTarget {
  /** Stable unique id for this target. */
  targetId: string;
  /** Zero-based index in the compiled .mind file. */
  targetIndex: number;
  /** The pair both cards in this pair share. Used by the adapter to resolve cardId. */
  pairId: string;
  /** Which AR object to show when this target is found. */
  arObjectId: string;
  /** Source image used to compile this target (human-readable reference). */
  imagePath: string;
}

export const AR_TARGETS: ArTarget[] = [
  {
    targetId: 'target_qawsi_seal',
    targetIndex: 0,
    pairId: 'pair_0',
    arObjectId: 'ar_obj_qawsi_seal',
    imagePath: '/ar/targets/cards/card-08-target.png',
  },
  // TODO: add entries here as each new card is printed and compiled into cards.mind
];

/** Resolve a MindAR target index → ArTarget (undefined if not registered). */
export function targetByIndex(index: number): ArTarget | undefined {
  return AR_TARGETS.find((t) => t.targetIndex === index);
}

/** Resolve a pairId → ArTarget (undefined if not registered). */
export function targetByPairId(pairId: string): ArTarget | undefined {
  return AR_TARGETS.find((t) => t.pairId === pairId);
}
