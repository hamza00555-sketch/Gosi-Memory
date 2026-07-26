import { CARDS, PAIRS } from '../../content';
import type { Command, CommandDraft, Rejection } from '../../domain/commands';
import type { RoomState } from '../../domain/game';
import type { TargetId, TeamId } from '../../domain/ids';
import { RULES } from '../rules/config';
import { createRoom, defaultRoomConfig } from './initGame';
import type { GameEvent } from './events';
import { reduce } from './reduce';

/**
 * A tiny driver for reducer tests.
 *
 * Time is explicit and hand-advanced — the engine never reads a clock, so a
 * whole match including timeouts and challenge windows runs deterministically
 * in microseconds.
 */
export class Harness {
  room: RoomState;
  now: number;
  events: GameEvent[] = [];
  lastRejection: Rejection | null = null;

  constructor(options: { targetScore?: number; seed?: number; start?: number } = {}) {
    this.now = options.start ?? 1_700_000_000_000;
    this.room = createRoom({
      id: 'room_test',
      code: 'TST1',
      hostUid: 'device_a',
      config: defaultRoomConfig(options.targetScore ?? 600),
      now: this.now,
      seed: options.seed ?? 12345,
    });
    // Second device claims teamB, as joining would do.
    this.room = {
      ...this.room,
      teams: { ...this.room.teams, teamB: { ...this.room.teams.teamB, deviceUid: 'device_b' } },
    };
  }

  advance(ms: number): this {
    this.now += ms;
    return this;
  }

  /** Apply a command. Returns true when accepted; records the rejection when not. */
  dispatch(partial: CommandDraft): boolean {
    const command = {
      ...partial,
      id: `cmd_${this.now}_${Math.floor(this.now % 100000)}_${partial.type}`,
      deviceUid: partial.teamId === 'teamA' ? 'device_a' : 'device_b',
      createdAt: this.now,
    } as Command;

    const result = reduce(this.room, command, this.now);
    if (result.ok) {
      this.room = result.value.room;
      this.events.push(...result.value.events);
      this.lastRejection = null;
      return true;
    }
    this.lastRejection = result.rejection;
    return false;
  }

  /** Leave the opening countdown and begin the first turn. */
  begin(): this {
    this.advance(RULES.countdownMs + 50);
    this.dispatch({ type: 'TURN_TIMEOUT', teamId: this.room.game.activeTeamId });
    return this;
  }

  scan(targetId: TargetId, teamId?: TeamId, confidence = 0.95): boolean {
    return this.dispatch({
      type: 'SCAN_TARGET',
      teamId: teamId ?? this.room.game.activeTeamId,
      targetId,
      confidence,
    });
  }

  ack(): boolean {
    return this.dispatch({ type: 'ACK_RESOLVE', teamId: this.room.game.activeTeamId });
  }

  timeout(teamId?: TeamId): boolean {
    return this.dispatch({ type: 'TURN_TIMEOUT', teamId: teamId ?? this.room.game.activeTeamId });
  }

  /** Scan both halves of a pair and settle the resolve beat. */
  playMatch(pairIndex: number, teamId?: TeamId): this {
    const team = teamId ?? this.room.game.activeTeamId;
    const [a, b] = pairOf(pairIndex);
    this.scan(a, team);
    this.scan(b, team);
    this.settleResolve();
    return this;
  }

  /** Scan two cards from different pairs and settle. */
  playMismatch(pairIndexA = 0, pairIndexB = 1, teamId?: TeamId): this {
    const team = teamId ?? this.room.game.activeTeamId;
    this.scan(pairOf(pairIndexA)[0], team);
    this.scan(pairOf(pairIndexB)[1], team);
    this.settleResolve();
    return this;
  }

  private settleResolve(): void {
    this.advance(RULES.resolveDisplayMs + 50);
    this.dispatch({ type: 'TURN_TIMEOUT', teamId: this.room.game.activeTeamId });
  }

  /** Run the current challenge to its deadline with no winner. */
  expireChallenge(): this {
    const challenge = this.room.challenge;
    if (!challenge) return this;
    this.now = challenge.endsAt + 50;
    this.dispatch({ type: 'TURN_TIMEOUT', teamId: this.room.game.activeTeamId });
    return this;
  }

  /** Win the current challenge for a team, bypassing type-specific answers. */
  winChallengeAs(teamId: TeamId): this {
    const challenge = this.room.challenge;
    if (!challenge) return this;
    this.now = Math.max(this.now, challenge.startsAt + challenge.headStartMs + 10);
    // reaction_rush only counts a press made after the target appears.
    if (challenge.payload.kind === 'reaction_rush') {
      this.now = Math.max(this.now, challenge.payload.revealAt + 10);
    }
    const answer = correctAnswerFor(this.room);
    this.dispatch({
      type: 'SUBMIT_CHALLENGE',
      teamId,
      answer: answer.answer,
      sequence: answer.sequence,
    });
    // If nothing settled it (e.g. an extra_attempt is still pending), expire it.
    if (this.room.game.phase === 'challenge') this.expireChallenge();
    return this;
  }

  /** Complete a full match turn: match a pair, then let the challenge lapse. */
  matchAndSkipChallenge(pairIndex: number, teamId?: TeamId): this {
    this.playMatch(pairIndex, teamId);
    if (this.room.game.phase === 'challenge') this.expireChallenge();
    return this;
  }

  score(teamId: TeamId): number {
    return this.room.game.scores[teamId] ?? 0;
  }

  eventsOfType<T extends GameEvent['type']>(type: T): Extract<GameEvent, { type: T }>[] {
    return this.events.filter((e) => e.type === type) as Extract<GameEvent, { type: T }>[];
  }
}

/** The two targetIds of the nth authored pair. */
export function pairOf(index: number): [TargetId, TargetId] {
  const pair = PAIRS[index];
  if (!pair) throw new Error(`no pair at index ${index}`);
  return pair.targetIds;
}

export function cardsOfPair(pairId: string): TargetId[] {
  return CARDS.filter((c) => c.pairId === pairId).map((c) => c.targetId);
}

/** Build a submission that satisfies whichever challenge is currently live. */
export function correctAnswerFor(room: RoomState): { answer: number; sequence: number[] } {
  const payload = room.challenge?.payload;
  if (!payload) return { answer: 0, sequence: [] };

  switch (payload.kind) {
    case 'visual_puzzle':
      return { answer: payload.correctAnswer, sequence: [] };
    case 'sequence_memory':
      return {
        answer: 0,
        sequence: payload.sequence.map((symbol) => payload.palette.indexOf(symbol)),
      };
    case 'reaction_rush':
      return { answer: 1, sequence: [] };
    case 'team_sync':
      return { answer: 3, sequence: [] };
    default:
      return { answer: 0, sequence: [] };
  }
}

export function newMatch(options?: { targetScore?: number; seed?: number }): Harness {
  return new Harness(options);
}
