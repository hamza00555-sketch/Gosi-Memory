import { describe, expect, it } from 'vitest';
import { PAIRS, getPuzzle } from '../../content';
import { MAX_PLAYERS_PER_TEAM } from '../../domain/teams';
import { RULES } from '../rules/config';
import { clampRoster, createTeam } from './initGame';
import { reduce } from './reduce';
import { newMatch, pairOf } from './testKit';

// The rules are asserted against the full authored pack. TOTAL_PAIRS counts
// only the pairs currently compiled into the target library, which would make
// these tests fail whenever the card artwork changes.
const PACK_PAIRS = PAIRS.length;

describe('roster limits', () => {
  it('never allows more than three players in a team', () => {
    const clamped = clampRoster(
      [{ name: 'أ' }, { name: 'ب' }, { name: 'ج' }, { name: 'د' }, { name: 'هـ' }],
      5,
    );
    expect(clamped.playerCount).toBe(MAX_PLAYERS_PER_TEAM);
    expect(clamped.players).toHaveLength(MAX_PLAYERS_PER_TEAM);
  });

  it('never allows fewer than one player', () => {
    expect(clampRoster([], 0).playerCount).toBe(1);
    expect(clampRoster([], -3).playerCount).toBe(1);
  });

  it('keeps playerCount and players in sync when a team is built', () => {
    const team = createTeam('teamA', { playerCount: 7, players: [{ name: 'س' }] });
    expect(team.playerCount).toBe(3);
    expect(team.players).toHaveLength(3);
    expect(team.players[0]?.name).toBe('س');
  });
});

describe('scan validation', () => {
  it('refuses a scan from the team that is not on turn', () => {
    const h = newMatch().begin();
    expect(h.room.game.activeTeamId).toBe('teamA');
    expect(h.scan(pairOf(0)[0], 'teamB')).toBe(false);
    expect(h.lastRejection?.code).toBe('NOT_YOUR_TURN');
  });

  it('refuses the same physical card twice', () => {
    const h = newMatch().begin();
    const [a] = pairOf(0);
    expect(h.scan(a)).toBe(true);
    expect(h.scan(a)).toBe(false);
    expect(h.lastRejection?.code).toBe('SAME_CARD_TWICE');
  });

  it('refuses a card whose pair is already matched', () => {
    const h = newMatch().begin().matchAndSkipChallenge(0);
    const [a] = pairOf(0);
    expect(h.scan(a)).toBe(false);
    expect(h.lastRejection?.code).toBe('ALREADY_MATCHED');
  });

  it('refuses a card that is not in the manifest', () => {
    const h = newMatch().begin();
    expect(h.scan('card_does_not_exist')).toBe(false);
    expect(h.lastRejection?.code).toBe('UNKNOWN_TARGET');
  });

  it('refuses a low-confidence reading', () => {
    const h = newMatch().begin();
    expect(h.scan(pairOf(0)[0], 'teamA', RULES.minScanConfidence - 0.1)).toBe(false);
    expect(h.lastRejection?.code).toBe('LOW_CONFIDENCE');
  });

  it('refuses a scan after the turn clock expired', () => {
    const h = newMatch().begin();
    h.advance(RULES.turnDurationMs + RULES.clockSkewToleranceMs + 500);
    expect(h.scan(pairOf(0)[0])).toBe(false);
    expect(h.lastRejection?.code).toBe('TURN_EXPIRED');
  });

  it('refuses a command that arrives far too late', () => {
    const h = newMatch().begin();
    const stale = {
      id: 'stale',
      teamId: 'teamA' as const,
      deviceUid: 'device_a',
      createdAt: h.now - RULES.maxCommandAgeMs - 1000,
      type: 'ACK_RESOLVE' as const,
    };
    const before = h.room.game.version;
    // Dispatched through reduce directly to keep the stale timestamp.
    const result = reduce(h.room, stale, h.now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('STALE_COMMAND');
    expect(h.room.game.version).toBe(before);
  });
});

describe('match and mismatch', () => {
  it('awards 100 and records the pair on a match', () => {
    const h = newMatch().begin();
    const [a, b] = pairOf(0);
    h.scan(a);
    h.scan(b);
    expect(h.room.game.phase).toBe('resolving');
    expect(h.room.game.lastOutcome?.kind).toBe('match');
    expect(h.score('teamA')).toBe(100);
    expect(h.room.game.matchedPairIds[PAIRS[0]!.pairId]).toBe(true);
  });

  it('awards nothing and keeps the pair open on a mismatch', () => {
    const h = newMatch().begin();
    h.scan(pairOf(0)[0]);
    h.scan(pairOf(1)[1]);
    expect(h.room.game.lastOutcome?.kind).toBe('mismatch');
    expect(h.score('teamA')).toBe(0);
    expect(Object.keys(h.room.game.matchedPairIds)).toHaveLength(0);
  });

  it('passes the turn to the other team after a mismatch', () => {
    const h = newMatch().begin().playMismatch(0, 1);
    expect(h.room.game.activeTeamId).toBe('teamB');
    expect(h.room.game.phase).toBe('scanning_first');
    expect(h.room.game.firstTargetId).toBeNull();
  });

  it('keeps the turn with the matching team after the challenge', () => {
    const h = newMatch().begin().matchAndSkipChallenge(0);
    expect(h.room.game.activeTeamId).toBe('teamA');
    expect(h.room.game.phase).toBe('scanning_first');
  });

  it('opens a challenge on every match', () => {
    const h = newMatch().begin().playMatch(0);
    expect(h.room.game.phase).toBe('challenge');
    expect(h.room.challenge).not.toBeNull();
    expect(h.room.challenge?.advantagedTeamId).toBe('teamA');
  });
});

describe('player rotation inside a team', () => {
  it('moves to the next teammate even when the team keeps the turn', () => {
    const h = newMatch();
    h.room = {
      ...h.room,
      teams: {
        ...h.room.teams,
        teamA: {
          ...h.room.teams.teamA,
          playerCount: 3,
          players: [{ name: 'أحمد' }, { name: 'سارة' }, { name: 'خالد' }],
        },
      },
    };
    h.begin();
    expect(h.room.teams.teamA.activePlayerIndex).toBe(0);

    h.matchAndSkipChallenge(0);
    expect(h.room.game.activeTeamId).toBe('teamA');
    expect(h.room.teams.teamA.activePlayerIndex).toBe(1);

    h.matchAndSkipChallenge(1);
    expect(h.room.teams.teamA.activePlayerIndex).toBe(2);

    h.matchAndSkipChallenge(2);
    expect(h.room.teams.teamA.activePlayerIndex).toBe(0);
  });

  it('advances the pointer of the team that just lost the turn', () => {
    const h = newMatch();
    h.room = {
      ...h.room,
      teams: {
        ...h.room.teams,
        teamA: {
          ...h.room.teams.teamA,
          playerCount: 2,
          players: [{ name: 'أ' }, { name: 'ب' }],
        },
      },
    };
    h.begin().playMismatch(0, 1);
    expect(h.room.game.activeTeamId).toBe('teamB');
    // teamA's next turn belongs to its second player.
    expect(h.room.teams.teamA.activePlayerIndex).toBe(1);
  });

  it('wraps a single-player team back to the same person', () => {
    const h = newMatch().begin().matchAndSkipChallenge(0);
    expect(h.room.teams.teamA.playerCount).toBe(1);
    expect(h.room.teams.teamA.activePlayerIndex).toBe(0);
  });
});

describe('turn timer', () => {
  it('passes the turn when the clock runs out', () => {
    const h = newMatch().begin();
    h.advance(RULES.turnDurationMs + 100);
    expect(h.timeout()).toBe(true);
    expect(h.room.game.activeTeamId).toBe('teamB');
    expect(h.eventsOfType('turn_expired')).toHaveLength(1);
  });

  it('refuses a timeout reported before the deadline', () => {
    const h = newMatch().begin();
    h.advance(1000);
    expect(h.timeout()).toBe(false);
    expect(h.lastRejection?.code).toBe('STALE_COMMAND');
  });
});

describe('challenge', () => {
  it('pays the winner exactly once', () => {
    const h = newMatch().begin().playMatch(0);
    const reward = h.room.challenge?.scoreReward ?? 50;
    h.winChallengeAs('teamB');

    const teamBScore = h.score('teamB');
    expect(teamBScore).toBeGreaterThanOrEqual(reward);

    // A late submission cannot reopen a settled challenge.
    const before = h.score('teamB');
    h.dispatch({ type: 'SUBMIT_CHALLENGE', teamId: 'teamB', answer: 0, sequence: [] });
    expect(h.score('teamB')).toBe(before);
  });

  it('records no winner when the challenge simply expires', () => {
    const h = newMatch().begin().playMatch(0);
    h.expireChallenge();
    expect(h.score('teamA')).toBe(100);
    expect(h.score('teamB')).toBe(0);
    expect(h.eventsOfType('challenge_resolved')[0]?.winnerTeamId).toBeNull();
  });

  it('is available to both teams, not only the matching one', () => {
    const h = newMatch().begin().playMatch(0);
    const challenge = h.room.challenge!;
    expect(challenge.advantagedTeamId).toBe('teamA');
    // The non-matching team can still submit and win.
    h.winChallengeAs('teamB');
    expect(h.score('teamB')).toBeGreaterThan(0);
  });

  it('blocks a submission before the challenge becomes interactive', () => {
    const h = newMatch().begin().playMatch(0);
    const challenge = h.room.challenge!;
    h.now = challenge.startsAt - RULES.clockSkewToleranceMs - 500;
    const accepted = h.dispatch({
      type: 'SUBMIT_CHALLENGE',
      teamId: 'teamB',
      answer: 0,
      sequence: [],
    });
    expect(accepted).toBe(false);
    expect(h.lastRejection?.code).toBe('CHALLENGE_NOT_STARTED');
  });

  it('returns the turn to the matching team once resolved', () => {
    const h = newMatch().begin().playMatch(0);
    h.winChallengeAs('teamB');
    expect(h.room.game.activeTeamId).toBe('teamA');
  });
});

describe('puzzle', () => {
  it('reveals a piece for the matching team only', () => {
    const h = newMatch().begin().matchAndSkipChallenge(0);
    expect(h.room.puzzles.teamA.revealedCount).toBe(1);
    expect(h.room.puzzles.teamB.revealedCount).toBe(0);
  });

  it('gives the two teams different puzzles', () => {
    const h = newMatch();
    expect(h.room.puzzles.teamA.puzzleId).not.toBe(h.room.puzzles.teamB.puzzleId);
  });

  it('rebuilds the identical board from the same seed', () => {
    const a = newMatch({ seed: 999 });
    const b = newMatch({ seed: 999 });
    expect(a.room.puzzles.teamA.revealOrder).toEqual(b.room.puzzles.teamA.revealOrder);
    expect(a.room.puzzles.teamA.puzzleId).toBe(b.room.puzzles.teamA.puzzleId);
  });

  it('awards 200 for a correct answer and issues a new puzzle', () => {
    const h = newMatch({ targetScore: 5000 }).begin().matchAndSkipChallenge(0);
    const puzzleId = h.room.puzzles.teamA.puzzleId;
    const correct = getPuzzle(puzzleId)!.correctAnswer;

    expect(h.dispatch({ type: 'OPEN_PUZZLE', teamId: 'teamA' })).toBe(true);
    expect(h.room.game.phase).toBe('puzzle');
    expect(h.dispatch({ type: 'ATTEMPT_PUZZLE', teamId: 'teamA', answer: correct })).toBe(true);

    expect(h.score('teamA')).toBe(100 + 200);
    expect(h.room.puzzles.teamA.puzzleId).not.toBe(puzzleId);
    expect(h.room.puzzles.teamA.revealedCount).toBe(0);
  });

  it('deducts 50 for a wrong answer and locks the button', () => {
    const h = newMatch().begin().matchAndSkipChallenge(0);
    const correct = getPuzzle(h.room.puzzles.teamA.puzzleId)!.correctAnswer;
    const wrong = (correct + 1) % 4;

    h.dispatch({ type: 'OPEN_PUZZLE', teamId: 'teamA' });
    h.dispatch({ type: 'ATTEMPT_PUZZLE', teamId: 'teamA', answer: wrong });

    expect(h.score('teamA')).toBe(50);
    expect(h.room.puzzles.teamA.lockedUntilNextTurn).toBe(true);
    expect(h.dispatch({ type: 'OPEN_PUZZLE', teamId: 'teamA' })).toBe(false);
    expect(h.lastRejection?.code).toBe('PUZZLE_LOCKED');
  });

  it('never lets a penalty push a score below zero', () => {
    const h = newMatch().begin();
    const correct = getPuzzle(h.room.puzzles.teamA.puzzleId)!.correctAnswer;

    h.dispatch({ type: 'OPEN_PUZZLE', teamId: 'teamA' });
    h.dispatch({ type: 'ATTEMPT_PUZZLE', teamId: 'teamA', answer: (correct + 2) % 4 });
    expect(h.score('teamA')).toBe(0);
  });

  it('unlocks the puzzle when the turn genuinely comes back to the team', () => {
    const h = newMatch().begin();
    const correct = getPuzzle(h.room.puzzles.teamA.puzzleId)!.correctAnswer;

    h.dispatch({ type: 'OPEN_PUZZLE', teamId: 'teamA' });
    h.dispatch({ type: 'ATTEMPT_PUZZLE', teamId: 'teamA', answer: (correct + 1) % 4 });
    expect(h.room.puzzles.teamA.lockedUntilNextTurn).toBe(true);

    h.playMismatch(0, 1);            // teamA loses the turn
    expect(h.room.game.activeTeamId).toBe('teamB');
    h.playMismatch(2, 3);            // teamB loses it back
    expect(h.room.game.activeTeamId).toBe('teamA');
    expect(h.room.puzzles.teamA.lockedUntilNextTurn).toBe(false);
  });

  it('refuses a puzzle attempt from the team that did not open it', () => {
    const h = newMatch().begin();
    h.dispatch({ type: 'OPEN_PUZZLE', teamId: 'teamA' });
    expect(h.dispatch({ type: 'ATTEMPT_PUZZLE', teamId: 'teamB', answer: 0 })).toBe(false);
    expect(h.lastRejection?.code).toBe('WRONG_PHASE');
  });

  it('refuses to open a puzzle out of turn', () => {
    const h = newMatch().begin();
    expect(h.dispatch({ type: 'OPEN_PUZZLE', teamId: 'teamB' })).toBe(false);
    expect(h.lastRejection?.code).toBe('NOT_YOUR_TURN');
  });
});

describe('winning', () => {
  it('ends the match the moment a team reaches the target score', () => {
    const h = newMatch({ targetScore: 500 }).begin();
    for (let i = 0; i < PACK_PAIRS && h.room.game.phase !== 'completed'; i++) {
      h.matchAndSkipChallenge(i);
    }
    expect(h.score('teamA')).toBeGreaterThanOrEqual(500);
    expect(h.room.game.phase).toBe('completed');
    expect(h.room.game.winnerTeamId).toBe('teamA');
    expect(h.room.status).toBe('completed');
  });

  it('refuses any further command once completed', () => {
    const h = newMatch({ targetScore: 200 }).begin();
    // Each pair can only be matched once, so walk the pack until someone wins.
    for (let i = 0; i < PACK_PAIRS && h.room.game.phase !== 'completed'; i++) {
      h.matchAndSkipChallenge(i);
    }
    expect(h.room.game.phase).toBe('completed');
    expect(h.scan(pairOf(PACK_PAIRS - 1)[0])).toBe(false);
    expect(h.lastRejection?.code).toBe('GAME_COMPLETED');
  });

  it('can be won by solving a puzzle', () => {
    const h = newMatch({ targetScore: 300 }).begin().matchAndSkipChallenge(0);
    const correct = getPuzzle(h.room.puzzles.teamA.puzzleId)!.correctAnswer;
    h.dispatch({ type: 'OPEN_PUZZLE', teamId: 'teamA' });
    h.dispatch({ type: 'ATTEMPT_PUZZLE', teamId: 'teamA', answer: correct });
    expect(h.room.game.phase).toBe('completed');
    expect(h.room.game.winnerTeamId).toBe('teamA');
  });
});

describe('round reset', () => {
  it('stops for a reshuffle when the pairs run out below the target', () => {
    const h = newMatch({ targetScore: 5000 }).begin();
    for (let i = 0; i < PACK_PAIRS; i++) h.matchAndSkipChallenge(i);

    expect(h.room.game.phase).toBe('round_reset');
    expect(Object.keys(h.room.game.matchedPairIds)).toHaveLength(PACK_PAIRS);
    expect(h.eventsOfType('round_exhausted')).toHaveLength(1);
  });

  it('starts a new round only when both teams confirm the reshuffle', () => {
    const h = newMatch({ targetScore: 5000 }).begin();
    for (let i = 0; i < PACK_PAIRS; i++) h.matchAndSkipChallenge(i);
    const carriedScore = h.score('teamA');

    expect(h.dispatch({ type: 'ROUND_READY', teamId: 'teamA' })).toBe(true);
    expect(h.room.game.phase).toBe('round_reset');

    expect(h.dispatch({ type: 'ROUND_READY', teamId: 'teamB' })).toBe(true);
    expect(h.room.game.phase).toBe('countdown');
    expect(h.room.game.roundNumber).toBe(2);
    expect(Object.keys(h.room.game.matchedPairIds)).toHaveLength(0);
    expect(h.score('teamA')).toBe(carriedScore);
  });

  it('gives both teams a fresh puzzle in the new round', () => {
    const h = newMatch({ targetScore: 5000 }).begin();
    for (let i = 0; i < PACK_PAIRS; i++) h.matchAndSkipChallenge(i);
    const before = h.room.puzzles.teamA.puzzleId;
    h.dispatch({ type: 'ROUND_READY', teamId: 'teamA' });
    h.dispatch({ type: 'ROUND_READY', teamId: 'teamB' });
    expect(h.room.puzzles.teamA.puzzleId).not.toBe(before);
    expect(h.room.puzzles.teamA.revealedCount).toBe(0);
  });
});

describe('state integrity', () => {
  it('increments the version on every accepted command and never on a refusal', () => {
    const h = newMatch().begin();
    const v0 = h.room.game.version;
    h.scan(pairOf(0)[0]);
    expect(h.room.game.version).toBe(v0 + 1);

    h.scan(pairOf(0)[0]); // same card twice — refused
    expect(h.room.game.version).toBe(v0 + 1);
  });

  it('is a pure function of state, command and time', () => {
    const a = newMatch({ seed: 77 }).begin().matchAndSkipChallenge(0);
    const b = newMatch({ seed: 77 }).begin().matchAndSkipChallenge(0);
    expect(JSON.stringify(a.room)).toBe(JSON.stringify(b.room));
  });

  it('holds only JSON-safe values so the state survives a round trip', () => {
    const h = newMatch().begin().matchAndSkipChallenge(0);
    const roundTripped = JSON.parse(JSON.stringify(h.room));
    expect(roundTripped).toEqual(h.room);
  });
});
