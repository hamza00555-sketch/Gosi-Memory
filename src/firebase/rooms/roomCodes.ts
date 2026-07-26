import type { RoomCode } from '../../domain/ids';
import { createRng, randomSeed } from '../../game/engine';

/**
 * Room codes are read aloud across a table, so the alphabet drops every glyph
 * that is mistaken for another: 0/O, 1/I/L, 5/S, 2/Z stay out or keep only the
 * unambiguous member.
 */
export const ROOM_CODE_ALPHABET = '346789ABCDEFGHJKMNPQRTUVWXY';
export const ROOM_CODE_LENGTH = 4;

export function generateRoomCode(): RoomCode {
  // Not game-affecting, but the engine's rng keeps Math.random out of the
  // codebase entirely; randomSeed() is crypto-backed where available.
  const rng = createRng(randomSeed());
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET.charAt(rng.int(ROOM_CODE_ALPHABET.length));
  }
  return code;
}

/** Uppercase, trimmed, whitespace-free — what the user typed is rarely exact. */
export function normalizeRoomCode(code: string): RoomCode {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

export { normalizeRoomCode as normalize };

export function isValidRoomCode(code: string): boolean {
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== ROOM_CODE_LENGTH) return false;
  for (const char of normalized) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}
