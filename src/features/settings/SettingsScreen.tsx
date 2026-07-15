import { useEffect, useState } from 'react';
import { AppHeader } from '../../components/AppHeader';
import { useI18n } from '../../i18n';
import { loadSetIndex, type SetIndexEntry } from '../../lib/sets';
import { useSettingsStore } from '../../state/settingsStore';

export default function SettingsScreen(): JSX.Element {
  const { t, language } = useI18n();
  const settings = useSettingsStore();
  const [sets, setSets] = useState<SetIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSetIndex()
      .then(setSets)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="flex h-full flex-col overflow-y-auto pb-8">
      <AppHeader title={t.settings.title} />

      <section className="mx-4 mt-2">
        <h2 className="mb-1 text-sm font-bold text-white/80">{t.settings.set}</h2>
        <p className="mb-3 text-xs text-white/50">{t.settings.setHint}</p>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          {(sets ?? []).map((s) => {
            const active = s.setId === settings.activeSetId;
            return (
              <button
                key={s.setId}
                type="button"
                onClick={() => settings.setActiveSetId(s.setId)}
                className={`rounded-2xl border p-4 text-start transition ${
                  active ? 'border-brand-cyan bg-brand-blue/15 shadow-glow' : 'border-white/10 bg-white/5'
                }`}
              >
                <div
                  className="mb-2 h-2 w-10 rounded-full"
                  style={{ backgroundColor: s.themeColor }}
                />
                <div className="font-display font-bold text-white">{s.name[language]}</div>
                {active ? <div className="mt-1 text-xs text-brand-cyan">✓</div> : null}
              </button>
            );
          })}
          {!sets && !error ? (
            <div className="col-span-2 text-sm text-white/50">{t.common.loading}</div>
          ) : null}
        </div>
      </section>

      <section className="mx-4 mt-6">
        <h2 className="mb-3 text-sm font-bold text-white/80">{t.settings.language}</h2>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { id: 'ar', label: 'العربية' },
              { id: 'en', label: 'English' },
            ] as const
          ).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => settings.setLanguage(l.id)}
              className={`rounded-xl border px-4 py-3 font-display font-bold transition ${
                settings.language === l.id
                  ? 'border-brand-cyan bg-brand-blue/15 text-white'
                  : 'border-white/10 bg-white/5 text-white/70'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-4 mt-6">
        <h2 className="mb-3 text-sm font-bold text-white/80">{t.settings.sound}</h2>
        <button
          type="button"
          onClick={() => settings.setSoundOn(!settings.soundOn)}
          className={`w-full rounded-xl border px-4 py-3 text-start font-display font-bold transition ${
            settings.soundOn
              ? 'border-brand-green/50 bg-brand-green/10 text-brand-green'
              : 'border-white/10 bg-white/5 text-white/60'
          }`}
        >
          {settings.soundOn ? `🔊 ${t.settings.on}` : `🔇 ${t.settings.off}`}
        </button>
      </section>
    </main>
  );
}
