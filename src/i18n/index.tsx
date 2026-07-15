import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSettingsStore } from '../state/settingsStore';
import { strings, type Language, type Strings } from './strings';

interface I18nValue {
  t: Strings;
  language: Language;
  dir: 'rtl' | 'ltr';
}

const I18nContext = createContext<I18nValue | null>(null);

/** Applies the language to <html> (dir + lang) and provides the dictionary. */
export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const language = useSettingsStore((s) => s.language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  const value = useMemo<I18nValue>(
    () => ({ t: strings[language] as Strings, language, dir }),
    [language, dir],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}
