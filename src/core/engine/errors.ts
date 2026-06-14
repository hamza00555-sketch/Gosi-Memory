/**
 * Every reason a move can be rejected. The engine returns these instead of
 * throwing, so callers (UI, services, server RPC) handle them uniformly.
 */
export type MoveErrorCode =
  | 'GAME_NOT_IN_PROGRESS'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'CARD_NOT_FOUND'
  | 'CARD_ALREADY_MATCHED'
  | 'CARD_ALREADY_SELECTED'
  | 'TOO_MANY_SELECTED'
  | 'NO_ATTEMPTS_LEFT'
  | 'EMPTY_GUESS'
  | 'STALE_VERSION';

export interface MoveError {
  code: MoveErrorCode;
  message: string;
}

export function moveError(code: MoveErrorCode, message: string): MoveError {
  return { code, message };
}

/** Discriminated result so success/failure is impossible to confuse. */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: MoveError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T>(error: MoveError): Result<T> => ({ ok: false, error });
