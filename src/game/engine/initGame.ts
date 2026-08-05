import { TOTAL_PAIRS } from '../../content';
import type { GameState, RoomConfig, RoomState } from '../../domain/game';
import type { DeviceUid, EpochMs, RoomCode, RoomId, TeamId } from '../../domain/ids';
import { DEFAULT_OBJECT_SET_ID } from '../../domain/objectSets';
import type { Team, TeamColor } from '../../domain/teams';
import { MAX_PLAYERS_PER_TEAM } from '../../domain/teams';
import { RULES } from '../rules/config';
import { createTeamPuzzle } from './puzzleFactory';
import { randomSeed } from './rng';

export function createTeam(
  id: TeamId,
  overrides: Partial<Omit<Team, 'id'>> = {},
): Team {
  const defaults: Omit<Team, 'id'> = {
    name: id === 'teamA' ? 'الفريق الأول' : 'الفريق الثاني',
    color: (id === 'teamA' ? 'coral' : 'violet') as TeamColor,
    playerCount: 1,
    players: [{ name: '' }],
    activePlayerIndex: 0,
    deviceUid: null,
    objectSetId: DEFAULT_OBJECT_SET_ID,
    ready: false,
  };
  const merged = { ...defaults, ...overrides };
  // playerCount and players.length must never disagree — the turn rotation
  // indexes players by playerCount and would otherwise skip a real person.
  const clamped = clampRoster(merged.players, merged.playerCount);
  return { id, ...merged, players: clamped.players, playerCount: clamped.playerCount };
}

/** Force a roster into 1..MAX_PLAYERS_PER_TEAM with matching count. */
export function clampRoster(
  players: { name: string }[],
  requestedCount: number,
): { players: { name: string }[]; playerCount: number } {
  const count = Math.min(
    MAX_PLAYERS_PER_TEAM,
    Math.max(1, Math.floor(requestedCount) || 1),
  );
  const next = Array.from({ length: count }, (_, i) => ({ name: players[i]?.name ?? '' }));
  return { players: next, playerCount: count };
}

export function createInitialGame(params: {
  targetScore: number;
  seed: number;
  startingTeamId: TeamId;
  now: EpochMs;
}): GameState {
  return {
    phase: 'countdown',
    roundNumber: 1,
    activeTeamId: params.startingTeamId,
    turnStartedAt: params.now,
    turnEndsAt: params.now + RULES.countdownMs + RULES.turnDurationMs,
    firstTargetId: null,
    secondTargetId: null,
    matchedPairIds: {},
    scores: { teamA: 0, teamB: 0 },
    targetScore: params.targetScore,
    seed: params.seed,
    version: 0,
    lastOutcome: null,
    winnerTeamId: null,
    countdownEndsAt: params.now + RULES.countdownMs,
    roundReadyTeams: {},
    puzzleTeamId: null,
  };
}

export function createRoom(params: {
  id: RoomId;
  code: RoomCode;
  hostUid: DeviceUid;
  config: RoomConfig;
  now: EpochMs;
  seed?: number;
}): RoomState {
  const seed = params.seed ?? randomSeed();
  return {
    id: params.id,
    code: params.code,
    hostUid: params.hostUid,
    status: 'lobby',
    createdAt: params.now,
    config: params.config,
    teams: {
      teamA: createTeam('teamA', { deviceUid: params.hostUid }),
      teamB: createTeam('teamB'),
    },
    game: createInitialGame({
      targetScore: params.config.targetScore,
      seed,
      startingTeamId: 'teamA',
      now: params.now,
    }),
    challenge: null,
    puzzles: {
      teamA: createTeamPuzzle(seed, 'teamA', 0),
      teamB: createTeamPuzzle(seed, 'teamB', 0),
    },
  };
}

export function defaultRoomConfig(targetScore = 600, pairCount = TOTAL_PAIRS): RoomConfig {
  return {
    targetScore,
    turnDurationMs: RULES.turnDurationMs,
    packId: 'qawsi_core_v1',
    pairCount,
  };
}

export const PAIRS_PER_ROUND = TOTAL_PAIRS;
