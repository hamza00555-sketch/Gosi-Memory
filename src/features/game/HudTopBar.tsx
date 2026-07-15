import { elapsedMs, remainingPairCount } from '../../core/engine/selectors';
import type { Game } from '../../core/types/game';
import { useI18n } from '../../i18n';
import type { MatchPlayer } from '../../state/matchStore';

interface HudTopBarProps {
  game: Game;
  players: MatchPlayer[];
  now: number;
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Scores + whose turn + progress. Pure presentation over the Game snapshot. */
export function HudTopBar({ game, players, now }: HudTopBarProps): JSX.Element {
  const { t } = useI18n();
  const solo = game.turnOrder.length === 1;

  return (
    <div className="pointer-events-none flex flex-col gap-2 p-3">
      <div className="hud-panel flex items-center justify-between gap-2 px-3 py-2 text-sm">
        {solo ? (
          <>
            <span className="text-white/70">
              {t.game.moves}: <b className="text-white">{game.moveCount}</b>
            </span>
            <span className="text-white/70">
              {t.game.time}: <b className="text-white">{formatTime(elapsedMs(game, now))}</b>
            </span>
          </>
        ) : (
          <div className="flex w-full items-center justify-between gap-1 overflow-x-auto">
            {game.turnOrder.map((pid) => {
              const active = pid === game.currentTurnPlayerId;
              const score = game.scores.find((s) => s.playerId === pid)?.score ?? 0;
              const name = players.find((p) => p.id === pid)?.name ?? pid;
              return (
                <div
                  key={pid}
                  className={`flex min-w-0 flex-1 flex-col items-center rounded-lg px-2 py-1 ${
                    active ? 'bg-brand-blue/25 ring-1 ring-brand-cyan' : ''
                  }`}
                >
                  <span className={`w-full truncate text-center text-xs ${active ? 'text-brand-cyan' : 'text-white/60'}`}>
                    {name}
                  </span>
                  <b className="text-white">{score}</b>
                </div>
              );
            })}
          </div>
        )}
        <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/80">
          {t.game.pairsLeft}: {remainingPairCount(game)}
        </span>
      </div>
    </div>
  );
}
