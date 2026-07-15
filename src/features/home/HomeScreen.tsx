import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDefaultConfig } from '../../core/engine/config';
import { initGame } from '../../core/engine/engine';
import type { GameMode } from '../../core/types/config';
import { generateId } from '../../core/utils/id';
import { useI18n } from '../../i18n';
import { loadSet, type CardSet } from '../../lib/sets';
import { Logo } from '../../components/Logo';
import { useMatchStore, type MatchPlayer } from '../../state/matchStore';
import { useSettingsStore } from '../../state/settingsStore';

export default function HomeScreen(): JSX.Element {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const activeSetId = useSettingsStore((s) => s.activeSetId);
  const setMatch = useMatchStore((s) => s.setMatch);

  const [mode, setMode] = useState<GameMode>('solo');
  const [names, setNames] = useState<string[]>(['', '']);
  const [set, setSet] = useState<CardSet | null>(null);
  const [setError, setSetError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSet(null);
    setSetError(null);
    loadSet(activeSetId)
      .then((s) => alive && setSet(s))
      .catch((e: unknown) => alive && setSetError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [activeSetId]);

  const start = (): void => {
    if (!set) return;
    const players: MatchPlayer[] =
      mode === 'solo'
        ? [{ id: 'p1', name: names[0]?.trim() || t.home.soloMode }]
        : names
            .map((n, i) => ({ id: `p${i + 1}`, name: n.trim() || `${t.home.playerName} ${i + 1}` }))
            .slice(0, 4);

    const config = getDefaultConfig(mode);
    const game = initGame({
      id: generateId('game'),
      setId: set.setId,
      config,
      pairIds: set.pairs.map((p) => p.pairId),
      turnOrder: players.map((p) => p.id),
      startedAt: Date.now(),
    });
    setMatch(game, players);
    navigate('/play');
  };

  return (
    <main className="flex h-full flex-col overflow-y-auto px-4 pb-8 pt-10">
      <div className="mb-2 flex justify-center">
        <Logo />
      </div>
      <p className="mb-6 text-center text-sm text-white/60">{t.tagline}</p>

      {/* Active set */}
      <section className="hud-panel mb-4 flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs text-white/50">{t.home.activeSet}</div>
          <div className="truncate font-display text-lg font-bold" style={{ color: set?.themeColor }}>
            {set ? set.name[language] : setError ? t.common.error : t.common.loading}
          </div>
          {setError ? <div className="mt-1 text-xs text-red-300">{setError}</div> : null}
        </div>
        <Link to="/settings" className="btn-ghost shrink-0 px-3 py-2 text-sm">
          {t.home.changeSet}
        </Link>
      </section>

      {/* Mode selection */}
      <section className="mb-4 grid grid-cols-2 gap-3">
        {(
          [
            { id: 'solo', name: t.home.soloMode, desc: t.home.soloDesc },
            { id: 'pass_play', name: t.home.passMode, desc: t.home.passDesc },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-2xl border p-4 text-start transition ${
              mode === m.id
                ? 'border-brand-cyan bg-brand-blue/15 shadow-glow'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="font-display text-lg font-bold text-white">{m.name}</div>
            <div className="mt-1 text-xs leading-5 text-white/60">{m.desc}</div>
          </button>
        ))}
      </section>

      {/* Players (pass & play) */}
      {mode === 'pass_play' ? (
        <section className="hud-panel mb-4 p-4">
          <div className="mb-2 text-sm font-bold text-white/80">{t.home.players}</div>
          <div className="flex flex-col gap-2">
            {names.map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={n}
                  onChange={(e) =>
                    setNames((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
                  }
                  placeholder={`${t.home.playerName} ${i + 1}`}
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-navy-900 px-3 py-2 text-white placeholder:text-white/30 focus:border-brand-cyan focus:outline-none"
                  maxLength={20}
                />
                {names.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => setNames((prev) => prev.filter((_, j) => j !== i))}
                    className="btn-ghost px-3 py-2 text-xs"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {names.length < 4 ? (
            <button
              type="button"
              onClick={() => setNames((prev) => [...prev, ''])}
              className="btn-ghost mt-3 w-full py-2 text-sm"
            >
              + {t.home.addPlayer}
            </button>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        onClick={start}
        disabled={!set}
        className="btn-primary w-full py-4 text-lg"
      >
        {t.home.play}
      </button>

      {/* How to play */}
      <section className="hud-panel mt-4 p-4 text-sm leading-6 text-white/70">
        <div className="mb-1 font-bold text-white/90">{t.home.howToTitle}</div>
        <ol className="list-inside list-decimal space-y-1">
          <li>{t.home.howTo1}</li>
          <li>{t.home.howTo2}</li>
          <li>{t.home.howTo3}</li>
        </ol>
      </section>

      {/* Tools */}
      <section className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Link to="/tools/print" className="btn-ghost py-3">
          🖨️ {t.home.printCards}
        </Link>
        <Link to="/tools/compile" className="btn-ghost py-3">
          🎯 {t.home.compileTargets}
        </Link>
      </section>
    </main>
  );
}
