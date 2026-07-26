import type { TeamColor } from '../domain/teams';

/**
 * Tailwind cannot see a class name that is built at runtime, so every team
 * colour is spelled out here as a complete literal class.
 */
export interface TeamColorTokens {
  /** Solid fill — chips, dots, progress bars. */
  fill: string;
  /** Softer tint for large surfaces behind text. */
  soft: string;
  text: string;
  ring: string;
  border: string;
  /** Raw hex, for SVG fills and inline gradients. */
  hex: string;
}

export const TEAM_COLOR_TOKENS: Record<TeamColor, TeamColorTokens> = {
  coral: {
    fill: 'bg-team-coral',
    soft: 'bg-team-coral/15',
    text: 'text-team-coral',
    ring: 'ring-team-coral',
    border: 'border-team-coral',
    hex: '#FF5F57',
  },
  violet: {
    fill: 'bg-team-violet',
    soft: 'bg-team-violet/15',
    text: 'text-team-violet',
    ring: 'ring-team-violet',
    border: 'border-team-violet',
    hex: '#8B5CF6',
  },
  lime: {
    fill: 'bg-team-lime',
    soft: 'bg-team-lime/15',
    text: 'text-team-lime',
    ring: 'ring-team-lime',
    border: 'border-team-lime',
    hex: '#57E08A',
  },
  amber: {
    fill: 'bg-team-amber',
    soft: 'bg-team-amber/15',
    text: 'text-team-amber',
    ring: 'ring-team-amber',
    border: 'border-team-amber',
    hex: '#FFB020',
  },
};

export function teamTokens(color: TeamColor): TeamColorTokens {
  return TEAM_COLOR_TOKENS[color];
}
