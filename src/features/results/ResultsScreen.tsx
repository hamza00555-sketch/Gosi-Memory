import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDefaultConfig } from '../../core/engine/config';
import { initGame } from '../../core/engine/engine';
import { elapsedMs } from '../../core/engine/selectors';
import { generateId } from '../../core/utils/id';
import { useI18n } from '../../i18n';
import { Logo } from '../../components/Logo';
import { useMatchStore } from '../../state/matchStore';

function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function ResultsScreen(): JSX.Element {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { game, players, setMatch, clear } = useMatchStore();

  useEffect(() => {
    if (!game || game.status !== 'completed') navigate('/', { replace: true });
  }, [game, navigate]);

  if (!game || game.status !== 'completed') return <div className="h-full bg-navy-950" />;

  const solo = game.turnOrder.length === 1;
  const winner = players.find((p) => p.id === game.winnerId);
  const totalPairs = game.deck.length / 2;
  const perfect = solo && game.moveCount === totalPairs;
  const ranked = [...game.scores].sort((a, b) => b.score - a.score);

  const playAgain = (): void => {
    const config = getDefaultConfig(game.mode);
    const fresh = initGame({
      id: generateId('game'),
      setId: game.setId,
      config,
      pairIds: [...new Set(game.deck.map((c) => c.pairId))],
      turnOrder: game.turnOrder,
      startedAt: Date.now(),
    });
    setMatch(fresh, players);
    navigate('/play');
  };

  return (
    <main className="flex h-full flex-col items-center overflow-y-auto px-6 pb-8 pt-12">
      <Logo size="sm" />
      <h1 className="mt-6 font-display text-3xl font-extrabold text-white">{t.results.title}</h1>

      <div className="mt-6 w-full max-w-sm">
        {solo ? (
          <div className="hud-panel flex flex-col items-center gap-3 p-6">
            <div className="text-5xl">🏆</div>
            {perfect ? (
              <div className="font-display text-lg font-bold text-brand-green">{t.results.perfect}</div>
            ) : null}
            <div className="flex w-full justify-around text-center">
              <div>
                <div className="text-xs text-white/50">{t.results.soloMoves}</div>
                <div className="font-display text-2xl font-bold text-white">{game.moveCount}</div>
              </div>
              <div>
                <div className="text-xs text-white/50">{t.results.soloTime}</div>
                <div className="font-display text-2xl font-bold text-white">
                  {formatTime(elapsedMs(game, Date.now()))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hud-panel flex flex-col items-center gap-4 p-6">
            <div className="text-5xl">{game.winnerId ? '🏆' : '🤝'}</div>
            <div className="font-display text-xl font-bold text-brand-cyan">
              {game.winnerId ? `${t.results.winner}: ${winner?.name ?? ''}` : t.results.draw}
            </div>
            <ul className="w-full space-y-2">
              {ranked.map((s, i) => {
                const name = players.find((p) => p.id === s.playerId)?.name ?? s.playerId;
                return (
                  <li
                    key={s.playerId}
                    className={`flex items-center justify-between rounded-xl px-4 py-2 ${
                      i === 0 && game.winnerId ? 'bg-brand-green/15 text-brand-green' : 'bg-white/5 text-white/80'
                    }`}
                  >
                    <span className="truncate">{name}</span>
                    <b>{s.score}</b>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <button type="button" onClick={playAgain} className="btn-primary w-full py-3">
          {t.results.playAgain}
        </button>
        <button
          type="button"
          onClick={() => {
            clear();
            navigate('/');
          }}
          className="btn-ghost w-full py-3"
        >
          {t.results.home}
        </button>
      </div>
    </main>
  );
}
