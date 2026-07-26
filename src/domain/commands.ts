import type { DeviceUid, EpochMs, TargetId, TeamId } from './ids';

/**
 * Intent sent by a device. Devices never write canonical game state; they append
 * a command and the host applies it. The payload carries intent only — never an
 * outcome, a score, or a turn change — so a tampered client cannot award itself
 * anything the rules would not have granted.
 */
export type CommandType =
  | 'SCAN_TARGET'
  | 'SUBMIT_CHALLENGE'
  | 'ATTEMPT_PUZZLE'
  | 'OPEN_PUZZLE'
  | 'ACK_RESOLVE'
  | 'TURN_TIMEOUT'
  | 'READY'
  | 'ROUND_READY';

interface CommandBase {
  id: string;
  teamId: TeamId;
  /** Filled from the authenticated uid; the security rules pin it to the writer. */
  deviceUid: DeviceUid;
  createdAt: EpochMs;
}

export type Command = CommandBase &
  (
    | { type: 'SCAN_TARGET'; targetId: TargetId; confidence: number }
    | { type: 'SUBMIT_CHALLENGE'; answer: number; sequence: number[] }
    | { type: 'ATTEMPT_PUZZLE'; answer: number }
    | { type: 'OPEN_PUZZLE' }
    | { type: 'ACK_RESOLVE' }
    | { type: 'TURN_TIMEOUT' }
    | { type: 'READY'; ready: boolean }
    | { type: 'ROUND_READY' }
  );

export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>;

/** Why the engine refused a command. Surfaced to the player as Arabic copy. */
export type RejectionCode =
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'UNKNOWN_TARGET'
  | 'ALREADY_MATCHED'
  | 'SAME_CARD_TWICE'
  | 'LOW_CONFIDENCE'
  | 'TURN_EXPIRED'
  | 'DUPLICATE_COMMAND'
  | 'STALE_COMMAND'
  | 'GAME_COMPLETED'
  | 'PUZZLE_LOCKED'
  | 'PUZZLE_ALREADY_SOLVED'
  | 'CHALLENGE_ALREADY_SUBMITTED'
  | 'CHALLENGE_NOT_STARTED'
  | 'CHALLENGE_OVER'
  | 'TOO_MANY_PLAYERS'
  | 'ROOM_FULL';

export interface Rejection {
  code: RejectionCode;
  message: string;
}

export type EngineResult<T> =
  | { ok: true; value: T }
  | { ok: false; rejection: Rejection };

export function ok<T>(value: T): EngineResult<T> {
  return { ok: true, value };
}

export function reject<T = never>(code: RejectionCode, message: string): EngineResult<T> {
  return { ok: false, rejection: { code, message } };
}
