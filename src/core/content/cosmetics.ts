import type { Cosmetic, CosmeticType } from '../types/cosmetics';
import catalog from '../../content/cosmetics.json';

const COSMETICS: Cosmetic[] = (catalog as { cosmetics: Cosmetic[] }).cosmetics;

export function getCosmetics(): Cosmetic[] {
  return COSMETICS;
}

export function getCosmeticsByType(type: CosmeticType): Cosmetic[] {
  return COSMETICS.filter((c) => c.type === type);
}

export function getCosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id);
}

/** The free, always-unlocked default for a cosmetic category. */
export function getDefaultCosmetic(type: CosmeticType): Cosmetic {
  const found = COSMETICS.find((c) => c.type === type && c.isDefault);
  if (!found) throw new Error(`No default cosmetic for type ${type}`);
  return found;
}
