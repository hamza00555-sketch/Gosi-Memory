import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CosmeticId } from '../core/types/ids';
import type { Player } from '../core/types/player';
import { getCosmetics, getDefaultCosmetic } from '../core/content/cosmetics';
import { generateId } from '../core/utils/id';

/**
 * Local player profile + cosmetic ownership. This is UI/session state only —
 * never game rules. Persisted so a returning player keeps their identity.
 * When Supabase auth is wired, hydrate this from the authenticated profile.
 */
interface SessionState {
  player: Player;
  ownedCosmetics: CosmeticId[];
  setDisplayName: (name: string) => void;
  addCoins: (amount: number) => void;
  addXp: (amount: number) => void;
  selectCardSkin: (id: CosmeticId) => void;
  selectArSet: (id: CosmeticId) => void;
  purchaseCosmetic: (id: CosmeticId) => { ok: boolean; reason?: string };
  isOwned: (id: CosmeticId) => boolean;
}

function createGuestPlayer(): Player {
  return {
    id: generateId('player'),
    displayName: 'لاعب قوسي',
    avatarUrl: null,
    level: 1,
    coins: 1000,
    xp: 0,
    selectedCardSkin: getDefaultCosmetic('card_skin').id,
    selectedArSet: getDefaultCosmetic('ar_set').id,
  };
}

function defaultOwned(): CosmeticId[] {
  return getCosmetics().filter((c) => c.isDefault).map((c) => c.id);
}

const XP_PER_LEVEL = 500;

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      player: createGuestPlayer(),
      ownedCosmetics: defaultOwned(),

      setDisplayName: (name) =>
        set((s) => ({ player: { ...s.player, displayName: name } })),

      addCoins: (amount) =>
        set((s) => ({
          player: { ...s.player, coins: Math.max(0, s.player.coins + amount) },
        })),

      addXp: (amount) =>
        set((s) => {
          const xp = s.player.xp + amount;
          const level = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
          return { player: { ...s.player, xp, level } };
        }),

      selectCardSkin: (id) => {
        if (!get().isOwned(id)) return;
        set((s) => ({ player: { ...s.player, selectedCardSkin: id } }));
      },

      selectArSet: (id) => {
        if (!get().isOwned(id)) return;
        set((s) => ({ player: { ...s.player, selectedArSet: id } }));
      },

      purchaseCosmetic: (id) => {
        const cosmetic = getCosmetics().find((c) => c.id === id);
        if (!cosmetic) return { ok: false, reason: 'العنصر غير موجود' };
        if (get().isOwned(id)) return { ok: true };
        const { player } = get();
        if (player.coins < cosmetic.price) {
          return { ok: false, reason: 'لا يوجد رصيد كافٍ' };
        }
        set((s) => ({
          player: { ...s.player, coins: s.player.coins - cosmetic.price },
          ownedCosmetics: [...s.ownedCosmetics, id],
        }));
        return { ok: true };
      },

      isOwned: (id) => get().ownedCosmetics.includes(id),
    }),
    { name: 'qawsi:session:v1' },
  ),
);
