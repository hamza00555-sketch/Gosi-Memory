import { TOTAL_PAIRS, getCard, getPuzzle, getTargetById } from '../../content';
import type { Command, EngineResult } from '../../domain/commands';
import { ok, reject } from '../../domain/commands';
import { CHALLENGE_SCORE, MATCH_SCORE, isScanPhase } from '../../domain/game';
import type { GamePhase, RoomState } from '../../domain/game';
import type { EpochMs, TeamId } from '../../domain/ids';
import { otherTeam } from '../../domain/ids';
import { PUZZLE_CORRECT_SCORE, PUZZLE_WRONG_PENALTY } from '../../domain/puzzle';
import { nextPlayerIndex } from '../../domain/teams';
import { RULES } from '../rules/config';
import { createChallenge, evaluateSubmission } from './challengeFactory';
import type { GameEvent } from './events';
import { createTeamPuzzle, revealNextPiece } from './puzzleFactory';

export interface ReduceOutput {
  room: RoomState;
  events: GameEvent[];
}

/**
 * The single source of game rules.
 *
 * Pure: same room + command + timestamp always yields the same result, with no
 * IO, no clock read and no randomness outside the match seed. The host runs it
 * inside a Realtime Database transaction to produce canonical state; tests run
 * it directly. Because a device can only *propose* a command, anything this
 * function refuses simply never happened.
 */
export function reduce(
  room: RoomState,
  command: Command,
  now: EpochMs,
): EngineResult<ReduceOutput> {
  if (command.createdAt > now + RULES.clockSkewToleranceMs) {
    return reject('STALE_COMMAND', 'طابع زمني غير صالح.');
  }
  if (now - command.createdAt > RULES.maxCommandAgeMs) {
    return reject('STALE_COMMAND', 'انتهت صلاحية هذه الحركة.');
  }

  const game = room.game;
  if (game.phase === 'completed' && command.type !== 'ROUND_READY') {
    return reject('GAME_COMPLETED', 'انتهت المباراة.');
  }

  switch (command.type) {
    case 'SCAN_TARGET':
      return handleScan(room, command, now);
    case 'ACK_RESOLVE':
      return handleAckResolve(room, now);
    case 'TURN_TIMEOUT':
      return handleDeadline(room, now);
    case 'OPEN_PUZZLE':
      return handleOpenPuzzle(room, command.teamId);
    case 'ATTEMPT_PUZZLE':
      return handleAttemptPuzzle(room, command.teamId, command.answer);
    case 'SUBMIT_CHALLENGE':
      return handleChallengeSubmission(room, command.teamId, command.answer, command.sequence, now);
    case 'READY':
      return handleReady(room, command.teamId, command.ready);
    case 'ROUND_READY':
      return handleRoundReady(room, command.teamId, now);
    default:
      return reject('WRONG_PHASE', 'أمر غير معروف.');
  }
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function handleScan(
  room: RoomState,
  command: Extract<Command, { type: 'SCAN_TARGET' }>,
  now: EpochMs,
): EngineResult<ReduceOutput> {
  const game = room.game;

  if (!isScanPhase(game.phase)) {
    return reject('WRONG_PHASE', 'لا يمكن تسجيل بطاقة الآن.');
  }
  if (command.teamId !== game.activeTeamId) {
    return reject('NOT_YOUR_TURN', 'ليس دور فريقك.');
  }
  if (now > game.turnEndsAt + RULES.clockSkewToleranceMs) {
    return reject('TURN_EXPIRED', 'انتهى وقت الدور.');
  }
  if (command.confidence < RULES.minScanConfidence) {
    return reject('LOW_CONFIDENCE', 'ثبت الجهاز قليلًا.');
  }

  const target = getTargetById(command.targetId);
  const card = getCard(command.targetId);
  if (!target || !card) {
    return reject('UNKNOWN_TARGET', 'بطاقة غير معروفة.');
  }
  if (game.matchedPairIds[card.pairId] === true) {
    return reject('ALREADY_MATCHED', 'هذه البطاقة تم جمعها.');
  }
  if (game.phase === 'scanning_second' && game.firstTargetId === command.targetId) {
    return reject('SAME_CARD_TWICE', 'اختر بطاقة مختلفة.');
  }

  const events: GameEvent[] = [];

  if (game.phase === 'scanning_first') {
    events.push({
      type: 'scan_accepted',
      teamId: command.teamId,
      targetId: command.targetId,
      slot: 'first',
    });
    return ok({
      room: bump(room, {
        game: { ...game, phase: 'scanning_second', firstTargetId: command.targetId },
      }),
      events,
    });
  }

  // Second card — this is where a turn is decided.
  events.push({
    type: 'scan_accepted',
    teamId: command.teamId,
    targetId: command.targetId,
    slot: 'second',
  });

  const firstCard = game.firstTargetId ? getCard(game.firstTargetId) : undefined;
  const isMatch = !!firstCard && firstCard.pairId === card.pairId;

  let next: RoomState = {
    ...room,
    game: {
      ...game,
      phase: 'resolving' as GamePhase,
      secondTargetId: command.targetId,
      lastOutcome: {
        kind: isMatch ? 'match' : 'mismatch',
        teamId: command.teamId,
        firstTargetId: game.firstTargetId ?? '',
        secondTargetId: command.targetId,
        pairId: isMatch ? card.pairId : null,
        at: now,
      },
    },
  };

  if (isMatch) {
    next = {
      ...next,
      game: {
        ...next.game,
        matchedPairIds: { ...next.game.matchedPairIds, [card.pairId]: true },
      },
    };
    next = addScore(next, command.teamId, MATCH_SCORE);

    const puzzle = revealNextPiece(next.puzzles[command.teamId]);
    next = { ...next, puzzles: { ...next.puzzles, [command.teamId]: puzzle } };

    events.push({
      type: 'match',
      teamId: command.teamId,
      pairId: card.pairId,
      points: MATCH_SCORE,
    });
    events.push({
      type: 'puzzle_piece_revealed',
      teamId: command.teamId,
      revealedCount: puzzle.revealedCount,
    });
  } else {
    events.push({
      type: 'mismatch',
      teamId: command.teamId,
      first: game.firstTargetId ?? '',
      second: command.targetId,
    });
  }

  return ok({ room: bump(next, {}), events });
}

// ---------------------------------------------------------------------------
// Phase advancement
// ---------------------------------------------------------------------------

function handleAckResolve(room: RoomState, now: EpochMs): EngineResult<ReduceOutput> {
  if (room.game.phase !== 'resolving') {
    // Both devices ack; the loser of the race is a harmless no-op.
    return reject('STALE_COMMAND', 'تم تجاوز هذه المرحلة.');
  }
  return ok(advanceFromResolving(room, now));
}

function advanceFromResolving(room: RoomState, now: EpochMs): ReduceOutput {
  const events: GameEvent[] = [];
  const outcome = room.game.lastOutcome;

  if (outcome?.kind === 'match') {
    // Every match opens a challenge, even the one that empties the table — the
    // round-reset check happens after it resolves.
    const matchIndex = Object.keys(room.game.matchedPairIds).length;
    const challenge = createChallenge(room.game.seed, matchIndex, outcome.teamId, now);
    events.push({
      type: 'challenge_started',
      challengeId: challenge.challengeId,
      advantagedTeamId: outcome.teamId,
    });
    return {
      room: bump(room, { game: { ...room.game, phase: 'challenge' }, challenge }),
      events,
    };
  }

  // Mismatch: no points, the turn changes hands.
  return endTurn(room, { keepTurn: false }, now, events);
}

/**
 * Deadline reached. One command covers every timed phase so the host needs a
 * single watchdog rather than one timer per phase, and a device that reports it
 * early is simply refused.
 */
function handleDeadline(room: RoomState, now: EpochMs): EngineResult<ReduceOutput> {
  const game = room.game;
  const events: GameEvent[] = [];

  switch (game.phase) {
    case 'countdown': {
      if (game.countdownEndsAt !== null && now < game.countdownEndsAt) {
        return reject('STALE_COMMAND', 'لم ينتهِ العد التنازلي.');
      }
      return ok(beginTurn(room, game.activeTeamId, now, events, { turnChanged: true }));
    }

    case 'resolving':
      if (now < (game.lastOutcome?.at ?? 0) + RULES.resolveDisplayMs) {
        return reject('STALE_COMMAND', 'لم تنتهِ لقطة النتيجة.');
      }
      return ok(advanceFromResolving(room, now));

    case 'challenge': {
      const challenge = room.challenge;
      if (!challenge) return reject('WRONG_PHASE', 'لا يوجد تحدٍ نشط.');
      if (now < challenge.endsAt) {
        return reject('STALE_COMMAND', 'التحدي ما زال جاريًا.');
      }
      return ok(resolveChallenge(room, now, events));
    }

    case 'scanning_first':
    case 'scanning_second': {
      if (now <= game.turnEndsAt) {
        return reject('STALE_COMMAND', 'ما زال هناك وقت.');
      }
      events.push({ type: 'turn_expired', teamId: game.activeTeamId });
      return ok(endTurn(room, { keepTurn: false }, now, events));
    }

    case 'puzzle':
      // Closing the puzzle sheet without answering costs nothing.
      return ok({ room: bump(room, { game: { ...game, phase: resumeScanPhase(room), puzzleTeamId: null } }), events });

    default:
      return reject('WRONG_PHASE', 'لا يوجد مؤقت في هذه المرحلة.');
  }
}

/** Which scan phase to return to after a modal closes, from the selections held. */
function resumeScanPhase(room: RoomState): GamePhase {
  const { firstTargetId, secondTargetId } = room.game;
  return firstTargetId && !secondTargetId ? 'scanning_second' : 'scanning_first';
}

// ---------------------------------------------------------------------------
// Turn lifecycle
// ---------------------------------------------------------------------------

/**
 * Close the current turn.
 *
 * The acting team's player pointer always advances — including when the team
 * keeps the turn after a match — so a strong player cannot monopolise the
 * table and every teammate gets to scan.
 */
function endTurn(
  room: RoomState,
  options: { keepTurn: boolean },
  now: EpochMs,
  events: GameEvent[],
): ReduceOutput {
  const actingTeamId = room.game.activeTeamId;
  const actingTeam = room.teams[actingTeamId];

  let next: RoomState = {
    ...room,
    teams: {
      ...room.teams,
      [actingTeamId]: { ...actingTeam, activePlayerIndex: nextPlayerIndex(actingTeam) },
    },
  };

  const winner = findWinner(next);
  if (winner) {
    events.push({ type: 'game_completed', winnerTeamId: winner });
    return {
      room: bump(next, {
        status: 'completed',
        game: { ...next.game, phase: 'completed', winnerTeamId: winner },
      }),
      events,
    };
  }

  if (Object.keys(next.game.matchedPairIds).length >= TOTAL_PAIRS) {
    events.push({ type: 'round_exhausted', roundNumber: next.game.roundNumber });
    return {
      room: bump(next, {
        game: {
          ...next.game,
          phase: 'round_reset',
          firstTargetId: null,
          secondTargetId: null,
          roundReadyTeams: {},
        },
        challenge: null,
      }),
      events,
    };
  }

  const nextTeamId = options.keepTurn ? actingTeamId : otherTeam(actingTeamId);
  return beginTurn(next, nextTeamId, now, events, { turnChanged: !options.keepTurn });
}

function beginTurn(
  room: RoomState,
  teamId: TeamId,
  now: EpochMs,
  events: GameEvent[],
  options: { turnChanged: boolean },
): ReduceOutput {
  let puzzles = room.puzzles;

  // A wrong puzzle guess locks the button "until the team's turn comes round
  // again" — that means a genuine hand-over, not merely continuing after a
  // match, so the penalty still costs something.
  if (options.turnChanged && puzzles[teamId].lockedUntilNextTurn) {
    puzzles = { ...puzzles, [teamId]: { ...puzzles[teamId], lockedUntilNextTurn: false } };
  }

  events.push({
    type: 'turn_started',
    teamId,
    playerIndex: room.teams[teamId].activePlayerIndex,
  });

  return {
    room: bump(room, {
      status: 'in_progress',
      puzzles,
      challenge: null,
      game: {
        ...room.game,
        phase: 'scanning_first',
        activeTeamId: teamId,
        turnStartedAt: now,
        turnEndsAt: now + RULES.turnDurationMs,
        firstTargetId: null,
        secondTargetId: null,
        countdownEndsAt: null,
        puzzleTeamId: null,
      },
    }),
    events,
  };
}

// ---------------------------------------------------------------------------
// Challenge
// ---------------------------------------------------------------------------

function handleChallengeSubmission(
  room: RoomState,
  teamId: TeamId,
  answer: number,
  sequence: number[],
  now: EpochMs,
): EngineResult<ReduceOutput> {
  const challenge = room.challenge;
  if (room.game.phase !== 'challenge' || !challenge) {
    return reject('WRONG_PHASE', 'لا يوجد تحدٍ نشط.');
  }
  if (challenge.resolved) {
    return reject('CHALLENGE_OVER', 'انتهى التحدي.');
  }
  if (now > challenge.endsAt + RULES.clockSkewToleranceMs) {
    return reject('CHALLENGE_OVER', 'انتهى وقت التحدي.');
  }

  const existing = challenge.submissions[teamId];
  // A second attempt is only allowed for the matching team, only when the
  // challenge grants one, and only once after a wrong first try.
  const mayRetry =
    !!existing &&
    !existing.correct &&
    existing.attempts < 2 &&
    challenge.advantage === 'extra_attempt' &&
    teamId === challenge.advantagedTeamId;
  if (existing && !mayRetry) {
    return reject('CHALLENGE_ALREADY_SUBMITTED', 'سجلت إجابتك بالفعل.');
  }

  const interactiveAt =
    challenge.advantage === 'head_start' && teamId !== challenge.advantagedTeamId
      ? challenge.startsAt + challenge.headStartMs
      : challenge.startsAt;
  if (now + RULES.clockSkewToleranceMs < interactiveAt) {
    return reject('CHALLENGE_NOT_STARTED', 'لم يبدأ التحدي بعد.');
  }

  const draft = {
    teamId,
    answer,
    sequence,
    submittedAt: now,
    attempts: (existing?.attempts ?? 0) + 1,
  };
  const correct = evaluateSubmission(challenge, draft, room.teams[teamId].playerCount);

  const next: RoomState = {
    ...room,
    challenge: {
      ...challenge,
      submissions: { ...challenge.submissions, [teamId]: { ...draft, correct } },
      // First correct answer takes it; a later correct answer cannot steal it.
      winnerTeamId: challenge.winnerTeamId ?? (correct ? teamId : null),
    },
  };

  const events: GameEvent[] = [];
  const updated = next.challenge!;
  const bothAnswered = !!updated.submissions.teamA && !!updated.submissions.teamB;
  const settled = updated.winnerTeamId !== null || (bothAnswered && !retryPending(updated));

  if (settled) {
    return ok(resolveChallenge(next, now, events));
  }
  return ok({ room: bump(next, {}), events });
}

/** True while the advantaged team still holds an unused extra attempt. */
function retryPending(challenge: NonNullable<RoomState['challenge']>): boolean {
  if (challenge.advantage !== 'extra_attempt') return false;
  const submission = challenge.submissions[challenge.advantagedTeamId];
  return !!submission && !submission.correct && submission.attempts < 2;
}

function resolveChallenge(room: RoomState, now: EpochMs, events: GameEvent[]): ReduceOutput {
  const challenge = room.challenge;
  if (!challenge || challenge.resolved) {
    return endTurn(room, { keepTurn: true }, now, events);
  }

  let next: RoomState = room;
  const winner = challenge.winnerTeamId;
  let points = 0;

  if (winner) {
    points = challenge.scoreReward || CHALLENGE_SCORE;
    if (challenge.advantage === 'score_bonus' && winner === challenge.advantagedTeamId) {
      points += RULES.challengeScoreBonus;
    }
    next = addScore(next, winner, points);
  }

  events.push({ type: 'challenge_resolved', winnerTeamId: winner, points });

  next = { ...next, challenge: { ...challenge, resolved: true } };

  // The team that earned the challenge keeps the turn regardless of who won it.
  return endTurn(next, { keepTurn: true }, now, events);
}

// ---------------------------------------------------------------------------
// Puzzle
// ---------------------------------------------------------------------------

function handleOpenPuzzle(room: RoomState, teamId: TeamId): EngineResult<ReduceOutput> {
  if (!isScanPhase(room.game.phase)) {
    return reject('WRONG_PHASE', 'لا يمكن فتح اللغز الآن.');
  }
  if (teamId !== room.game.activeTeamId) {
    return reject('NOT_YOUR_TURN', 'ليس دور فريقك.');
  }
  const puzzle = room.puzzles[teamId];
  if (puzzle.solved) {
    return reject('PUZZLE_ALREADY_SOLVED', 'تم حل هذا اللغز.');
  }
  if (puzzle.lockedUntilNextTurn) {
    return reject('PUZZLE_LOCKED', 'اللغز مقفل حتى يعود دوركم.');
  }

  return ok({
    room: bump(room, { game: { ...room.game, phase: 'puzzle', puzzleTeamId: teamId } }),
    events: [{ type: 'puzzle_opened', teamId }],
  });
}

function handleAttemptPuzzle(
  room: RoomState,
  teamId: TeamId,
  answer: number,
): EngineResult<ReduceOutput> {
  if (room.game.phase !== 'puzzle' || room.game.puzzleTeamId !== teamId) {
    return reject('WRONG_PHASE', 'لا يوجد لغز مفتوح لفريقك.');
  }
  const puzzle = room.puzzles[teamId];
  if (puzzle.solved) {
    return reject('PUZZLE_ALREADY_SOLVED', 'تم حل هذا اللغز.');
  }

  const definition = puzzleDefinitionOf(room, teamId);
  const correct = !!definition && answer === definition.correctAnswer;
  const events: GameEvent[] = [];
  let next: RoomState = room;

  if (correct) {
    next = addScore(next, teamId, PUZZLE_CORRECT_SCORE);
    events.push({ type: 'puzzle_solved', teamId, points: PUZZLE_CORRECT_SCORE });

    // Straight into the next picture, unless this just won the match.
    const wonNow = findWinner(next) === teamId;
    const replacement = wonNow
      ? { ...puzzle, solved: true, attempts: puzzle.attempts + 1 }
      : createTeamPuzzle(next.game.seed, teamId, puzzle.sequenceIndex + 1);
    next = { ...next, puzzles: { ...next.puzzles, [teamId]: replacement } };
  } else {
    next = addScore(next, teamId, -PUZZLE_WRONG_PENALTY);
    events.push({ type: 'puzzle_failed', teamId, penalty: PUZZLE_WRONG_PENALTY });
    next = {
      ...next,
      puzzles: {
        ...next.puzzles,
        [teamId]: { ...puzzle, lockedUntilNextTurn: true, attempts: puzzle.attempts + 1 },
      },
    };
  }

  const winner = findWinner(next);
  if (winner) {
    events.push({ type: 'game_completed', winnerTeamId: winner });
    return ok({
      room: bump(next, {
        status: 'completed',
        game: { ...next.game, phase: 'completed', winnerTeamId: winner, puzzleTeamId: null },
      }),
      events,
    });
  }

  return ok({
    room: bump(next, {
      game: { ...next.game, phase: resumeScanPhase(next), puzzleTeamId: null },
    }),
    events,
  });
}

function puzzleDefinitionOf(room: RoomState, teamId: TeamId) {
  return getPuzzle(room.puzzles[teamId].puzzleId);
}

// ---------------------------------------------------------------------------
// Lobby / rounds
// ---------------------------------------------------------------------------

function handleReady(
  room: RoomState,
  teamId: TeamId,
  ready: boolean,
): EngineResult<ReduceOutput> {
  const teams = { ...room.teams, [teamId]: { ...room.teams[teamId], ready } };
  return ok({ room: bump({ ...room, teams }, {}), events: [] });
}

function handleRoundReady(
  room: RoomState,
  teamId: TeamId,
  now: EpochMs,
): EngineResult<ReduceOutput> {
  if (room.game.phase !== 'round_reset') {
    return reject('WRONG_PHASE', 'لا توجد جولة بانتظار البدء.');
  }

  const roundReadyTeams = { ...room.game.roundReadyTeams, [teamId]: true as const };
  const bothReady = roundReadyTeams.teamA === true && roundReadyTeams.teamB === true;

  if (!bothReady) {
    return ok({ room: bump(room, { game: { ...room.game, roundReadyTeams } }), events: [] });
  }

  // Fresh round: the table is reshuffled, scores carry over, both teams get a
  // new picture, and the countdown re-syncs the two devices.
  const roundNumber = room.game.roundNumber + 1;
  const events: GameEvent[] = [{ type: 'round_started', roundNumber }];

  return ok({
    room: bump(room, {
      status: 'in_progress',
      challenge: null,
      puzzles: {
        teamA: createTeamPuzzle(room.game.seed, 'teamA', room.puzzles.teamA.sequenceIndex + 1),
        teamB: createTeamPuzzle(room.game.seed, 'teamB', room.puzzles.teamB.sequenceIndex + 1),
      },
      game: {
        ...room.game,
        phase: 'countdown',
        roundNumber,
        matchedPairIds: {},
        firstTargetId: null,
        secondTargetId: null,
        lastOutcome: null,
        roundReadyTeams: {},
        puzzleTeamId: null,
        countdownEndsAt: now + RULES.countdownMs,
        turnStartedAt: now,
        turnEndsAt: now + RULES.countdownMs + RULES.turnDurationMs,
      },
    }),
    events,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Apply a score delta, never letting a team drop below zero. */
function addScore(room: RoomState, teamId: TeamId, delta: number): RoomState {
  const current = room.game.scores[teamId] ?? 0;
  const nextScore = Math.max(0, current + delta);
  return {
    ...room,
    game: { ...room.game, scores: { ...room.game.scores, [teamId]: nextScore } },
  };
}

function findWinner(room: RoomState): TeamId | null {
  const { scores, targetScore } = room.game;
  const a = scores.teamA ?? 0;
  const b = scores.teamB ?? 0;
  if (a >= targetScore && a >= b) return 'teamA';
  if (b >= targetScore) return 'teamB';
  return null;
}

/**
 * Apply a patch and advance the version. Every accepted command bumps it, which
 * is what lets the host reject a transaction written against stale state.
 */
function bump(room: RoomState, patch: Partial<RoomState>): RoomState {
  const merged = { ...room, ...patch };
  return {
    ...merged,
    game: { ...merged.game, version: room.game.version + 1 },
  };
}
