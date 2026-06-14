import type { CosmeticId } from './ids';

export type CosmeticType =
  | 'card_skin'
  | 'ar_set'
  | 'match_effect'
  | 'victory_effect';

export interface Cosmetic {
  id: CosmeticId;
  name: string;
  type: CosmeticType;
  /** Item asset ids belonging to this cosmetic (e.g. AR objects in a set). */
  items: string[];
  /** Cost in coins. 0 means free / default. */
  price: number;
  /** Default cosmetics are unlocked for everyone from the start. */
  isDefault: boolean;
  /** Short marketing line shown in the store. */
  description: string;
}

/** A player's ownership + selection state, resolved against the catalog. */
export interface CosmeticOwnership {
  cosmeticId: CosmeticId;
  isUnlocked: boolean;
  isSelected: boolean;
}
