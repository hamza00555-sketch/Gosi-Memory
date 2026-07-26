import type { Team } from '../domain/teams';
import { teamTokens } from './teamColors';

export type TeamBadgeSize = 'sm' | 'md' | 'lg';

const DOT: Record<TeamBadgeSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
};

const NAME: Record<TeamBadgeSize, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
};

const BOX: Record<TeamBadgeSize, string> = {
  sm: 'gap-2 px-2.5 py-1',
  md: 'gap-2.5 px-3 py-1.5',
  lg: 'gap-3 px-4 py-2',
};

interface TeamBadgeProps {
  team: Team;
  size?: TeamBadgeSize;
  /** Lifts the badge when it is this team's turn. */
  active?: boolean;
  className?: string;
}

export function TeamBadge({
  team,
  size = 'md',
  active = false,
  className = '',
}: TeamBadgeProps): JSX.Element {
  const tokens = teamTokens(team.color);

  return (
    <span
      className={`inline-flex min-w-0 items-center rounded-pill font-display font-bold ${BOX[size]} ${
        active ? `${tokens.soft} ring-2 ${tokens.ring}` : 'bg-white/5'
      } ${className}`}
    >
      <span className={`shrink-0 rounded-pill ${DOT[size]} ${tokens.fill}`} aria-hidden="true" />
      <span className={`truncate text-cream ${NAME[size]}`}>{team.name}</span>
    </span>
  );
}

export default TeamBadge;
