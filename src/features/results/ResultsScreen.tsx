import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { allMatched, teamOf } from '../../core/engine/selectors';
import { useRoomGame } from '../../hooks/useRoomGame';
import { useSessionStore } from '../../state/sessionStore';
import { ar } from '../../i18n/ar';

// Module-level guard so rewards are granted once per game even under StrictMode.
const rewarded = new Set<string>();

export default function ResultsScreen(): JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const player = useSessionStore((s) => s.player);
  const addCoins = useSessionStore((s) => s.addCoins);
  const addXp = useSessionStore((s) => s.addXp);
  const { room, game } = useRoomGame(roomId);
  const awardedRef = useRef(false);

  const myTeam = game ? teamOf(game, player.id) : null;
  const iWon = useMemo(() => {
    if (!game) return false;
    return game.winnerId === player.id || (myTeam !== null && game.winnerTeamId === myTeam);
  }, [game, player.id, myTeam]);

  const phraseSolved = game ? !allMatched(game) : false;

  useEffect(() => {
    if (!game || game.status !== 'completed' || awardedRef.current) return;
    if (rewarded.has(game.id)) return;
    rewarded.add(game.id);
    awardedRef.current = true;
    const coins = iWon ? 120 : 40;
    const xp = iWon ? 80 : 30;
    addCoins(coins);
    addXp(xp);
  }, [game, iWon, addCoins, addXp]);

  if (!game) {
    return (
      <div className="flex h-full items-center justify-center text-white/60">
        {ar.common.loading}
      </div>
    );
  }

  const names: Record<string, string> = {};
  room?.members.forEach((m) => (names[m.playerId] = m.displayName));
  const isDraw = game.winnerId === null && game.winnerTeamId === null;
  const reward = iWon ? { coins: 120, xp: 80 } : { coins: 40, xp: 30 };

  return (
    <div className="flex h-full flex-col px-5 pb-6 pt-10">
      <h1 className="text-center font-display text-sm tracking-widest text-white/50">
        {ar.results.title}
      </h1>

      <div className="mt-6 text-center">
        <div className="text-6xl">{isDraw ? '🤝' : iWon ? '🏆' : '🎖️'}</div>
        <div
          className={`mt-3 font-display text-2xl font-extrabold ${
            iWon ? 'text-brand-green' : 'text-white'
          }`}
        >
          {isDraw ? ar.results.draw : iWon ? ar.results.youWon : ar.results.youLost}
        </div>
        <div className="mt-1 text-xs text-white/50">
          {phraseSolved ? ar.results.phraseSolved : ar.results.phraseUnsolved} ·{' '}
          <span className="text-brand-cyan">{game.hiddenPhrase.fullText}</span>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-bold text-white/70">{ar.results.scoreBreakdown}</h2>
        <ul className="flex flex-col gap-2">
          {[...game.scores]
            .sort((a, b) => b.score - a.score)
            .map((s) => (
              <li
                key={s.playerId}
                className="hud-panel flex items-center justify-between p-3"
              >
                <span className="text-sm font-bold text-white">
                  {s.playerId === player.id ? ar.common.you : names[s.playerId] ?? '—'}
                </span>
                <span className="flex items-center gap-4 text-sm">
                  <span className="text-white/50">
                    {ar.results.matchedPairs}: {s.matchedPairs}
                  </span>
                  <span className="font-display text-lg font-bold text-brand-cyan">
                    {s.score}
                  </span>
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold text-white/70">{ar.results.rewards}</h2>
        <div className="hud-panel flex items-center justify-around p-4">
          <span className="font-display text-lg font-bold text-brand-cyan">
            +{reward.coins} ✦
          </span>
          <span className="font-display text-lg font-bold text-brand-purple">
            +{reward.xp} XP
          </span>
        </div>
      </section>

      <div className="mt-auto flex gap-3 pt-6">
        <button onClick={() => navigate('/')} className="btn-ghost flex-1">
          {ar.results.backHome}
        </button>
        <button onClick={() => navigate('/')} className="btn-primary flex-1">
          {ar.results.playAgain}
        </button>
      </div>
    </div>
  );
}
