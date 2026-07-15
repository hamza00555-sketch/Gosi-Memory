import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAudioMuted } from '../lib/audio';
import type { Language } from '../i18n/strings';
import type { SetId } from '../core/types/ids';

export const DEFAULT_SET_ID: SetId = 'beach-day';

/**
 * Player preferences. This is the "customize" the user asked for: the active
 * card set is switched here and every screen (game, print, compile) follows.
 */
interface SettingsState {
  language: Language;
  soundOn: boolean;
  activeSetId: SetId;
  setLanguage: (l: Language) => void;
  setSoundOn: (on: boolean) => void;
  setActiveSetId: (id: SetId) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ar',
      soundOn: true,
      activeSetId: DEFAULT_SET_ID,
      setLanguage: (language) => set({ language }),
      setSoundOn: (soundOn) => {
        setAudioMuted(!soundOn);
        set({ soundOn });
      },
      setActiveSetId: (activeSetId) => set({ activeSetId }),
    }),
    {
      name: 'gosi:settings:v1',
      onRehydrateStorage: () => (state) => {
        if (state) setAudioMuted(!state.soundOn);
      },
    },
  ),
);
