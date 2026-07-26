import type { DeviceUid, ObjectSetId, TeamId } from './ids';

/** Hard cap from the game design. Enforced in the engine, not just the UI. */
export const MAX_PLAYERS_PER_TEAM = 3;
export const MIN_PLAYERS_PER_TEAM = 1;

export const TEAM_COLORS = ['coral', 'violet', 'lime', 'amber'] as const;
export type TeamColor = (typeof TEAM_COLORS)[number];

export interface TeamPlayer {
  /** Display name; may be empty — the UI falls back to "اللاعب N". */
  name: string;
}

export interface Team {
  id: TeamId;
  name: string;
  color: TeamColor;
  /** 1..MAX_PLAYERS_PER_TEAM. Always equals players.length. */
  playerCount: number;
  players: TeamPlayer[];
  /**
   * Whose turn it is *within* this team. Advances every time the team's turn
   * ends — including when the team keeps the turn after a match, so a
   * different teammate always plays next.
   */
  activePlayerIndex: number;
  /** The device that claimed this team. Null until a device joins it. */
  deviceUid: DeviceUid | null;
  /** Per-device cosmetic choice. Never affects game logic. */
  objectSetId: ObjectSetId;
  ready: boolean;
}

export function playerLabel(team: Team, index: number): string {
  const explicit = team.players[index]?.name?.trim();
  return explicit && explicit.length > 0 ? explicit : `اللاعب ${index + 1}`;
}

export function activePlayerLabel(team: Team): string {
  return playerLabel(team, team.activePlayerIndex);
}

/**
 * Advance to the next teammate, wrapping around. Called whenever this team's
 * turn ends, so all members participate.
 */
export function nextPlayerIndex(team: Team): number {
  const count = Math.max(1, team.playerCount);
  return (team.activePlayerIndex + 1) % count;
}
