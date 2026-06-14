import { z } from 'zod';

/**
 * Runtime validation for every payload that crosses a trust boundary
 * (client -> service -> server). Types are inferred from these schemas so the
 * static types and runtime checks can never drift apart.
 */

export const gameModeSchema = z.enum(['solo_ai', 'one_vs_one', 'two_vs_two']);
export const roomStatusSchema = z.enum([
  'waiting',
  'ready',
  'in_progress',
  'completed',
]);

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,8}$/, 'رمز الغرفة غير صالح');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'الاسم قصير جدًا')
  .max(24, 'الاسم طويل جدًا');

export const moveSchema = z.object({
  playerId: z.string().min(1),
  roomId: z.string().min(1),
  gameId: z.string().min(1),
  selectedCardId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
});

export const solveAttemptSchema = z.object({
  playerId: z.string().min(1),
  roomId: z.string().min(1),
  gameId: z.string().min(1),
  guess: z.string().trim().min(1, 'اكتب الجملة').max(200),
  timestamp: z.number().int().nonnegative(),
});

export const createRoomSchema = z.object({
  mode: gameModeSchema,
  host: z.object({
    playerId: z.string().min(1),
    displayName: displayNameSchema,
    avatarUrl: z.string().url().nullable().default(null),
  }),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  player: z.object({
    playerId: z.string().min(1),
    displayName: displayNameSchema,
    avatarUrl: z.string().url().nullable().default(null),
  }),
});

export const setReadySchema = z.object({
  roomId: z.string().min(1),
  playerId: z.string().min(1),
  isReady: z.boolean(),
});

export type MovePayload = z.infer<typeof moveSchema>;
export type SolveAttemptPayload = z.infer<typeof solveAttemptSchema>;
export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type SetReadyPayload = z.infer<typeof setReadySchema>;

/** Parse helper returning a discriminated result instead of throwing. */
export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { ok: true; value: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? 'بيانات غير صالحة' };
}
