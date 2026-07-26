import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import type { TeamId } from '../domain/ids';
import type { Team } from '../domain/teams';
import { ar } from '../i18n/ar';
import { teamTokens } from './teamColors';

/** Spring count-up so a +100 lands as a physical event, not a text swap. */
export function useCountUp(value: number): number {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduceMotion) {
      from.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(from.current, value, {
      type: 'spring',
      stiffness: 140,
      damping: 20,
      onUpdate: (latest: number) => setDisplay(Math.round(latest)),
      onComplete: () => setDisplay(value),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduceMotion]);

  return display;
}

interface ScoreRowProps {
  team: Team;
  score: number;
  targetScore: number;
  active: boolean;
  compact: boolean;
}

function ScoreRow({ team, score, targetScore, active, compact }: ScoreRowProps): JSX.Element {
  const tokens = teamTokens(team.color);
  const shown = useCountUp(score);
  const progress = Math.min(1, targetScore > 0 ? score / targetScore : 0);

  return (
    <div
      className={`rounded-chunk px-3 py-2 transition-colors ${
        active ? `${tokens.soft} ring-2 ${tokens.ring}` : 'bg-white/5'
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className={`shrink-0 rounded-pill ${tokens.fill} ${compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'}`} aria-hidden="true" />
        <span
          className={`min-w-0 flex-1 truncate font-display font-bold text-cream ${
            compact ? 'text-sm' : 'text-lg'
          }`}
        >
          {team.name}
        </span>
        <span
          className={`nums font-display font-black text-cream ${compact ? 'text-xl' : 'text-3xl'}`}
        >
          {shown}
        </span>
      </div>

      <div
        className={`mt-2 overflow-hidden rounded-pill bg-ink-950/60 ${compact ? 'h-1.5' : 'h-2.5'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={targetScore}
        aria-valuenow={score}
        aria-label={team.name}
      >
        <div
          className={`h-full rounded-pill transition-[width] duration-500 ease-out ${tokens.fill}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

interface ScoreBarProps {
  teamA: Team;
  teamB: Team;
  scores: Record<TeamId, number>;
  targetScore: number;
  /** Whose turn it is; null outside a turn. */
  activeTeamId?: TeamId | null;
  compact?: boolean;
  className?: string;
}

export function ScoreBar({
  teamA,
  teamB,
  scores,
  targetScore,
  activeTeamId = null,
  compact = false,
  className = '',
}: ScoreBarProps): JSX.Element {
  const scoreA = scores.teamA ?? 0;
  const scoreB = scores.teamB ?? 0;
  const activeTeam = activeTeamId === 'teamA' ? teamA : activeTeamId === 'teamB' ? teamB : null;

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <ScoreRow
        team={teamA}
        score={scoreA}
        targetScore={targetScore}
        active={activeTeamId === 'teamA'}
        compact={compact}
      />
      <ScoreRow
        team={teamB}
        score={scoreB}
        targetScore={targetScore}
        active={activeTeamId === 'teamB'}
        compact={compact}
      />

      <p aria-live="polite" className="sr-only col-span-2">
        {`${teamA.name} ${scoreA} ${ar.common.points} · ${teamB.name} ${scoreB} ${ar.common.points}`}
        {activeTeam ? ` · ${ar.game.turnOf} ${activeTeam.name}` : ''}
      </p>
    </div>
  );
}

export default ScoreBar;
