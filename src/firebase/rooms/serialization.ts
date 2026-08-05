import type {
  ChallengeAdvantage,
  ChallengePayload,
  ChallengeState,
  ChallengeSubmission,
  ChallengeType,
} from '../../domain/challenge';
import type { GamePhase, GameState, RoomConfig, RoomState, RoomStatus, TurnOutcome } from '../../domain/game';
import type { PairId, TeamId } from '../../domain/ids';
import { TEAM_IDS } from '../../domain/ids';
import { DEFAULT_OBJECT_SET_ID } from '../../domain/objectSets';
import type { TeamPuzzleState } from '../../domain/puzzle';
import type { Team, TeamColor, TeamPlayer } from '../../domain/teams';
import { TEAM_COLORS } from '../../domain/teams';
import { clampRoster, createTeamPuzzle } from '../../game/engine';
import { TOTAL_PAIRS } from '../../content';
import { RULES } from '../../game/rules/config';

/**
 * Realtime Database is not a JSON store, it is a tree of keys, and it drops
 * anything that looks empty:
 *
 *  - a key whose value is `undefined` is rejected outright by the SDK;
 *  - a key whose value is `null`, `{}` or `[]` is deleted from the tree;
 *  - a dense array comes back as an array, but a sparse or partially written
 *    one comes back as an object keyed by index.
 *
 * So the wire format is lossy by design, and `fromRtdb` is the place that makes
 * it lossless again: every optional collection has a defaulted shape and every
 * nullable leaf is restored to `null` rather than left `undefined`. Round-tripping
 * a RoomState through `toRtdb` → RTDB → `fromRtdb` yields an equal RoomState.
 */

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  // An empty string is preserved as-is; only a missing/deleted key becomes null.
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asNullableOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Accepts both wire forms of a list: a real array, or the index-keyed object
 * RTDB produces once a list has ever been sparse. Holes are dropped rather than
 * preserved as undefined — an undefined element would crash every consumer.
 */
function asList<T>(value: unknown, read: (item: unknown) => T | undefined): T[] {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : Object.entries(asRecord(value))
        .map(([key, item]) => [Number(key), item] as const)
        .filter(([key]) => Number.isFinite(key))
        .sort((a, b) => a[0] - b[0])
        .map(([, item]) => item);

  const out: T[] = [];
  for (const item of raw) {
    if (item === null || item === undefined) continue;
    const parsed = read(item);
    if (parsed !== undefined) out.push(parsed);
  }
  return out;
}

function asStringList(value: unknown): string[] {
  return asList(value, (item) => (typeof item === 'string' ? item : undefined));
}

function asNumberList(value: unknown): number[] {
  return asList(value, (item) =>
    typeof item === 'number' && Number.isFinite(item) ? item : undefined,
  );
}

/** `Record<K, true>` used as a set — any truthy stored value counts as present. */
function asFlagRecord(value: unknown): Record<string, true> {
  const out: Record<string, true> = {};
  for (const [key, flag] of Object.entries(asRecord(value))) {
    if (flag === true) out[key] = true;
  }
  return out;
}

const PHASES: readonly GamePhase[] = [
  'countdown',
  'scanning_first',
  'scanning_second',
  'resolving',
  'challenge',
  'puzzle',
  'round_reset',
  'completed',
];

const STATUSES: readonly RoomStatus[] = ['lobby', 'in_progress', 'completed'];

const CHALLENGE_TYPES: readonly ChallengeType[] = [
  'reaction_rush',
  'sequence_memory',
  'visual_puzzle',
  'team_sync',
];

const ADVANTAGES: readonly ChallengeAdvantage[] = ['head_start', 'extra_attempt', 'score_bonus'];

// ---------------------------------------------------------------------------
// toRtdb
// ---------------------------------------------------------------------------

/**
 * Recursively drop `undefined`. Nulls are kept: writing an explicit null is how
 * a stale child is deleted, which matters because the host merges its
 * serialized room over the raw node inside a transaction.
 */
export function stripUndefined<T>(value: T): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      out[key] = stripUndefined(item);
    }
    return out;
  }
  return value === undefined ? null : value;
}

function teamToRtdb(team: Team): unknown {
  return {
    id: team.id,
    name: team.name,
    color: team.color,
    playerCount: team.playerCount,
    players: team.players.map((player) => ({ name: player.name })),
    activePlayerIndex: team.activePlayerIndex,
    deviceUid: team.deviceUid,
    objectSetId: team.objectSetId,
    ready: team.ready,
  };
}

function outcomeToRtdb(outcome: TurnOutcome | null): unknown {
  if (!outcome) return null;
  return {
    kind: outcome.kind,
    teamId: outcome.teamId,
    firstTargetId: outcome.firstTargetId,
    secondTargetId: outcome.secondTargetId,
    pairId: outcome.pairId,
    at: outcome.at,
  };
}

function payloadToRtdb(payload: ChallengePayload): unknown {
  switch (payload.kind) {
    case 'reaction_rush':
      return { kind: payload.kind, revealAt: payload.revealAt };
    case 'sequence_memory':
      return {
        kind: payload.kind,
        sequence: payload.sequence.slice(),
        palette: payload.palette.slice(),
        hideAtMs: payload.hideAtMs,
      };
    case 'visual_puzzle':
      return {
        kind: payload.kind,
        options: payload.options.slice(),
        correctAnswer: payload.correctAnswer,
        image: payload.image,
      };
    case 'team_sync':
      return { kind: payload.kind, zones: payload.zones };
    default:
      return { kind: 'team_sync', zones: 0 };
  }
}

function challengeToRtdb(challenge: ChallengeState | null): unknown {
  if (!challenge) return null;
  const submissions: Record<string, unknown> = {};
  for (const teamId of TEAM_IDS) {
    const submission = challenge.submissions[teamId];
    if (!submission) continue;
    submissions[teamId] = {
      teamId: submission.teamId,
      answer: submission.answer,
      sequence: submission.sequence.slice(),
      submittedAt: submission.submittedAt,
      correct: submission.correct,
      attempts: submission.attempts,
    };
  }
  return {
    challengeId: challenge.challengeId,
    type: challenge.type,
    prompt: challenge.prompt,
    startsAt: challenge.startsAt,
    endsAt: challenge.endsAt,
    advantagedTeamId: challenge.advantagedTeamId,
    advantage: challenge.advantage,
    headStartMs: challenge.headStartMs,
    scoreReward: challenge.scoreReward,
    payload: payloadToRtdb(challenge.payload),
    submissions,
    winnerTeamId: challenge.winnerTeamId,
    resolved: challenge.resolved,
  };
}

function puzzleToRtdb(puzzle: TeamPuzzleState): unknown {
  return {
    puzzleId: puzzle.puzzleId,
    revealOrder: puzzle.revealOrder.slice(),
    revealedCount: puzzle.revealedCount,
    solved: puzzle.solved,
    lockedUntilNextTurn: puzzle.lockedUntilNextTurn,
    attempts: puzzle.attempts,
    sequenceIndex: puzzle.sequenceIndex,
  };
}

function gameToRtdb(game: GameState): unknown {
  const matchedPairIds: Record<PairId, true> = {};
  for (const pairId of Object.keys(game.matchedPairIds)) {
    if (game.matchedPairIds[pairId] === true) matchedPairIds[pairId] = true;
  }
  const roundReadyTeams: Record<string, true> = {};
  for (const teamId of Object.keys(game.roundReadyTeams)) {
    if (game.roundReadyTeams[teamId] === true) roundReadyTeams[teamId] = true;
  }
  return {
    phase: game.phase,
    roundNumber: game.roundNumber,
    activeTeamId: game.activeTeamId,
    turnStartedAt: game.turnStartedAt,
    turnEndsAt: game.turnEndsAt,
    firstTargetId: game.firstTargetId,
    secondTargetId: game.secondTargetId,
    matchedPairIds,
    scores: { teamA: game.scores.teamA ?? 0, teamB: game.scores.teamB ?? 0 },
    targetScore: game.targetScore,
    seed: game.seed,
    version: game.version,
    lastOutcome: outcomeToRtdb(game.lastOutcome),
    winnerTeamId: game.winnerTeamId,
    countdownEndsAt: game.countdownEndsAt,
    roundReadyTeams,
    puzzleTeamId: game.puzzleTeamId,
  };
}

export function toRtdb(room: RoomState): unknown {
  return {
    id: room.id,
    code: room.code,
    hostUid: room.hostUid,
    status: room.status,
    createdAt: room.createdAt,
    config: {
      targetScore: room.config.targetScore,
      turnDurationMs: room.config.turnDurationMs,
      packId: room.config.packId,
    },
    teams: {
      teamA: teamToRtdb(room.teams.teamA),
      teamB: teamToRtdb(room.teams.teamB),
    },
    game: gameToRtdb(room.game),
    challenge: challengeToRtdb(room.challenge),
    puzzles: {
      teamA: puzzleToRtdb(room.puzzles.teamA),
      teamB: puzzleToRtdb(room.puzzles.teamB),
    },
  };
}

// ---------------------------------------------------------------------------
// fromRtdb
// ---------------------------------------------------------------------------

function teamFromRtdb(raw: unknown, teamId: TeamId): Team {
  const source = asRecord(raw);
  const players: TeamPlayer[] = asList(source['players'], (item) => {
    if (typeof item === 'string') return { name: item };
    const record = asRecord(item);
    return { name: asString(record['name'], '') };
  });
  const roster = clampRoster(
    players.length > 0 ? players : [{ name: '' }],
    asNumber(source['playerCount'], Math.max(1, players.length)),
  );
  const defaultColor: TeamColor = teamId === 'teamA' ? 'coral' : 'violet';
  return {
    id: teamId,
    name: asString(source['name'], teamId === 'teamA' ? 'الفريق الأول' : 'الفريق الثاني'),
    color: asOneOf(source['color'], TEAM_COLORS, defaultColor),
    playerCount: roster.playerCount,
    players: roster.players.map((player) => ({ name: player.name })),
    activePlayerIndex: Math.min(
      Math.max(0, Math.floor(asNumber(source['activePlayerIndex'], 0))),
      roster.playerCount - 1,
    ),
    deviceUid: asNullableString(source['deviceUid']),
    objectSetId: asString(source['objectSetId'], DEFAULT_OBJECT_SET_ID),
    ready: asBoolean(source['ready'], false),
  };
}

function outcomeFromRtdb(raw: unknown): TurnOutcome | null {
  if (raw === null || raw === undefined) return null;
  const source = asRecord(raw);
  const kind = asNullableOneOf(source['kind'], ['match', 'mismatch'] as const);
  if (!kind) return null;
  return {
    kind,
    teamId: asOneOf(source['teamId'], TEAM_IDS, 'teamA'),
    firstTargetId: asString(source['firstTargetId'], ''),
    secondTargetId: asString(source['secondTargetId'], ''),
    pairId: asNullableString(source['pairId']),
    at: asNumber(source['at'], 0),
  };
}

function payloadFromRtdb(raw: unknown, type: ChallengeType): ChallengePayload {
  const source = asRecord(raw);
  const kind = asOneOf(source['kind'], CHALLENGE_TYPES, type);
  switch (kind) {
    case 'reaction_rush':
      return { kind, revealAt: asNumber(source['revealAt'], 0) };
    case 'sequence_memory':
      return {
        kind,
        sequence: asStringList(source['sequence']),
        palette: asStringList(source['palette']),
        hideAtMs: asNumber(source['hideAtMs'], RULES.sequenceShowMs),
      };
    case 'visual_puzzle':
      return {
        kind,
        options: asStringList(source['options']),
        correctAnswer: asNumber(source['correctAnswer'], -1),
        image: asNullableString(source['image']),
      };
    case 'team_sync':
    default:
      return { kind: 'team_sync', zones: asNumber(source['zones'], 1) };
  }
}

function submissionFromRtdb(raw: unknown, teamId: TeamId): ChallengeSubmission {
  const source = asRecord(raw);
  return {
    teamId: asOneOf(source['teamId'], TEAM_IDS, teamId),
    answer: asNumber(source['answer'], -1),
    sequence: asNumberList(source['sequence']),
    submittedAt: asNumber(source['submittedAt'], 0),
    correct: asBoolean(source['correct'], false),
    attempts: asNumber(source['attempts'], 1),
  };
}

function challengeFromRtdb(raw: unknown): ChallengeState | null {
  if (raw === null || raw === undefined) return null;
  const source = asRecord(raw);
  const challengeId = asString(source['challengeId'], '');
  if (challengeId.length === 0) return null;

  const type = asOneOf(source['type'], CHALLENGE_TYPES, 'reaction_rush');
  const submissions: Partial<Record<TeamId, ChallengeSubmission>> = {};
  const rawSubmissions = asRecord(source['submissions']);
  for (const teamId of TEAM_IDS) {
    const entry = rawSubmissions[teamId];
    if (entry === undefined || entry === null) continue;
    submissions[teamId] = submissionFromRtdb(entry, teamId);
  }

  return {
    challengeId,
    type,
    prompt: asString(source['prompt'], ''),
    startsAt: asNumber(source['startsAt'], 0),
    endsAt: asNumber(source['endsAt'], 0),
    advantagedTeamId: asOneOf(source['advantagedTeamId'], TEAM_IDS, 'teamA'),
    advantage: asOneOf(source['advantage'], ADVANTAGES, 'head_start'),
    headStartMs: asNumber(source['headStartMs'], RULES.challengeHeadStartMs),
    scoreReward: asNumber(source['scoreReward'], 0),
    payload: payloadFromRtdb(source['payload'], type),
    submissions,
    winnerTeamId: asNullableOneOf(source['winnerTeamId'], TEAM_IDS),
    resolved: asBoolean(source['resolved'], false),
  };
}

function puzzleFromRtdb(raw: unknown, seed: number, teamId: TeamId): TeamPuzzleState {
  if (raw === null || raw === undefined) return createTeamPuzzle(seed, teamId, 0);
  const source = asRecord(raw);
  const puzzleId = asString(source['puzzleId'], '');
  if (puzzleId.length === 0) {
    return createTeamPuzzle(seed, teamId, asNumber(source['sequenceIndex'], 0));
  }
  const revealOrder = asNumberList(source['revealOrder']);
  return {
    puzzleId,
    revealOrder,
    revealedCount: Math.min(Math.max(0, asNumber(source['revealedCount'], 0)), revealOrder.length),
    solved: asBoolean(source['solved'], false),
    lockedUntilNextTurn: asBoolean(source['lockedUntilNextTurn'], false),
    attempts: asNumber(source['attempts'], 0),
    sequenceIndex: asNumber(source['sequenceIndex'], 0),
  };
}

function gameFromRtdb(raw: unknown, config: RoomConfig, createdAt: number): GameState {
  const source = asRecord(raw);
  const scores = asRecord(source['scores']);
  return {
    phase: asOneOf(source['phase'], PHASES, 'countdown'),
    roundNumber: asNumber(source['roundNumber'], 1),
    activeTeamId: asOneOf(source['activeTeamId'], TEAM_IDS, 'teamA'),
    turnStartedAt: asNumber(source['turnStartedAt'], createdAt),
    turnEndsAt: asNumber(source['turnEndsAt'], createdAt),
    firstTargetId: asNullableString(source['firstTargetId']),
    secondTargetId: asNullableString(source['secondTargetId']),
    matchedPairIds: asFlagRecord(source['matchedPairIds']),
    scores: { teamA: asNumber(scores['teamA'], 0), teamB: asNumber(scores['teamB'], 0) },
    targetScore: asNumber(source['targetScore'], config.targetScore),
    seed: asNumber(source['seed'], 1),
    version: asNumber(source['version'], 0),
    lastOutcome: outcomeFromRtdb(source['lastOutcome']),
    winnerTeamId: asNullableOneOf(source['winnerTeamId'], TEAM_IDS),
    countdownEndsAt: asNullableNumber(source['countdownEndsAt']),
    roundReadyTeams: asFlagRecord(source['roundReadyTeams']),
    puzzleTeamId: asNullableOneOf(source['puzzleTeamId'], TEAM_IDS),
  };
}

export function fromRtdb(raw: unknown): RoomState {
  const source = asRecord(raw);
  const createdAt = asNumber(source['createdAt'], 0);
  const rawConfig = asRecord(source['config']);
  const config: RoomConfig = {
    targetScore: asNumber(rawConfig['targetScore'], 600),
    turnDurationMs: asNumber(rawConfig['turnDurationMs'], RULES.turnDurationMs),
    packId: asString(rawConfig['packId'], 'qawsi_core_v1'),
    // Rooms written before pairCount existed fall back to today's playable
    // count rather than zero, which would end the round immediately.
    pairCount: asNumber(rawConfig['pairCount'], TOTAL_PAIRS),
  };

  const game = gameFromRtdb(source['game'], config, createdAt);
  const rawTeams = asRecord(source['teams']);
  const rawPuzzles = asRecord(source['puzzles']);

  return {
    id: asString(source['id'], ''),
    code: asString(source['code'], ''),
    hostUid: asString(source['hostUid'], ''),
    status: asOneOf(source['status'], STATUSES, 'lobby'),
    createdAt,
    config,
    teams: {
      teamA: teamFromRtdb(rawTeams['teamA'], 'teamA'),
      teamB: teamFromRtdb(rawTeams['teamB'], 'teamB'),
    },
    game,
    challenge: challengeFromRtdb(source['challenge']),
    puzzles: {
      teamA: puzzleFromRtdb(rawPuzzles['teamA'], game.seed, 'teamA'),
      teamB: puzzleFromRtdb(rawPuzzles['teamB'], game.seed, 'teamB'),
    },
  };
}

/**
 * Overlay a room onto the raw node it came from. The host applies commands with
 * a transaction on `rooms/{id}`, whose value also carries presence, the command
 * queue and the processed/rejection ledgers — subtrees the engine knows nothing
 * about and must not erase.
 */
export function mergeRoomIntoRaw(raw: unknown, room: RoomState): Record<string, unknown> {
  const base = asRecord(raw);
  return { ...base, ...(toRtdb(room) as Record<string, unknown>) };
}
