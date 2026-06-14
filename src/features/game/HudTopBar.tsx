import type { Game } from '../../core/types/game';
import { ar } from '../../i18n/ar';

interface HudTopBarProps {
  game: Game;
  names: Record<string, string>;
  meId: string;
  remainingMs: number;
}

/** Top HUD strip: turn indicator, timer ring, and live scores. */
export function HudTopBar({ game, names, meId, remainingMs }: HudTopBarProps): JSX.Element {
  const myTurn = game.currentTurnPlayerId === meId;
  const turnName = names[game.currentTurnPlayerId] ?? '—';
  const showTimer = remainingMs > 0;
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="flex flex-1 gap-2">
        {game.scores.map((s) => (
          <div
            key={s.playerId}
            className={`hud-panel flex min-w-0 flex-1 flex-col items-center px-2 py-1.5 ${
              s.playerId === game.currentTurnPlayerId ? 'animate-pulse-ring' : ''
            }`}
          >
            <span className="max-w-full truncate text-[11px] text-white/60">
              {s.playerId === meId ? ar.common.you : names[s.playerId] ?? '—'}
            </span>
            <span className="font-display text-lg font-extrabold text-brand-cyan">
              {s.score}
            </span>
          </div>
        ))}
      </div>

      {showTimer && (
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 font-display text-lg font-bold ${
            seconds <= 5 ? 'border-red-400 text-red-300' : 'border-brand-cyan text-brand-cyan'
          }`}
        >
          {seconds}
        </div>
      )}

      <div
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
          myTurn ? 'bg-brand-green/20 text-brand-green' : 'bg-white/5 text-white/50'
        }`}
      >
        {myTurn ? ar.game.yourTurn : `${ar.game.opponentTurn}: ${turnName}`}
      </div>
    </div>
  );
}
