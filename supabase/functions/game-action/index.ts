// Supabase Edge Function: game-action
//
// THE authoritative writer for all game mutations. It reuses the EXACT same
// engine as the client (no rule duplication): the client runs `reduce`
// optimistically; this function runs the identical `reduce` as the source of
// truth and persists the result.
//
// Flow per request:
//   1. Authenticate the caller (JWT -> user id). The move's playerId is forced
//      to the authenticated id; a client cannot act as someone else.
//   2. Lock the game row (SELECT ... FOR UPDATE via lock_game) so two moves
//      cannot interleave.
//   3. Hydrate the Game JSON, build the engine action, run `reduce`.
//   4. Persist via commit_game with an optimistic version check; on conflict
//      the client simply refetches and retries.
//
// DEPLOY NOTE: the shared engine is imported from ../_shared/core. Before
// deploying, make src/core available there (symlink or copy):
//     ln -s ../../../src/core supabase/functions/_shared/core
// Deno will bundle it. Keeping src/core framework-free is what makes this reuse
// possible.

import { createClient } from 'jsr:@supabase/supabase-js@2';
// @ts-expect-error — resolved at deploy time (see DEPLOY NOTE above).
import { reduce, getDefaultConfig, initGame } from '../_shared/core/index.ts';

interface ActionBody {
  kind: 'start_game' | 'select_card' | 'end_reveal' | 'solve_phrase' | 'timeout';
  roomId?: string;
  gameId?: string;
  playerId?: string; // ignored for auth; identity comes from the JWT
  cardId?: string;
  guess?: string;
}

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await db.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return json({ error: 'AUTH_REQUIRED' }, 401);

    const body = (await req.json()) as ActionBody;

    if (body.kind === 'start_game') {
      return await startGame(db, body.roomId!, uid);
    }
    return await applyAction(db, body, uid);
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});

async function applyAction(db: any, body: ActionBody, uid: string): Promise<Response> {
  // 1+2: lock the game row.
  const { data: locked, error: lockErr } = await db.rpc('lock_game', {
    p_game: body.gameId,
  });
  if (lockErr || !locked) return json({ error: 'GAME_NOT_FOUND' }, 404);

  const game = locked.state;
  const config = getDefaultConfig(game.mode);

  // 3: build the engine action with the AUTHENTICATED id (never the client's).
  const action =
    body.kind === 'select_card'
      ? { type: 'SELECT_CARD', playerId: uid, cardId: body.cardId }
      : body.kind === 'end_reveal'
        ? { type: 'END_REVEAL', playerId: uid }
        : body.kind === 'solve_phrase'
          ? { type: 'SOLVE_PHRASE', playerId: uid, guess: body.guess }
          : { type: 'TIMEOUT', playerId: uid };

  const result = reduce(game, action, config, Date.now());
  if (!result.ok) return json({ error: result.error.code }, 409);

  // 4: optimistic commit guarded by version.
  const { data: committed, error: commitErr } = await db.rpc('commit_game', {
    p_game: body.gameId,
    p_expected_version: game.version,
    p_state: result.value.game,
    p_status: result.value.game.status,
  });
  if (commitErr) return json({ error: commitErr.message }, 409);

  return json(committed, 200);
}

async function startGame(db: any, roomId: string, uid: string): Promise<Response> {
  const { data: room } = await db.from('rooms').select('*').eq('id', roomId).single();
  if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
  if (room.host_id !== uid) return json({ error: 'NOT_HOST' }, 403);
  if (room.status !== 'ready') return json({ error: 'NOT_READY' }, 409);

  const { data: members } = await db
    .from('room_members')
    .select('player_id')
    .eq('room_id', roomId);
  const turnOrder = (members ?? []).map((m: { player_id: string }) => m.player_id);

  // Build the initial game with the shared engine. pickPhrase/seed selection
  // can live in _shared/core too; omitted here for brevity.
  const seed = Math.floor(Math.random() * 0xffffffff);
  const config = getDefaultConfig(room.mode);
  // NOTE: pass a phrase loaded from a phrases table or bundled JSON.
  const game = initGame({
    id: crypto.randomUUID(),
    roomId,
    mode: room.mode,
    config,
    phrase: room.phrase ?? FALLBACK_PHRASE,
    turnOrder,
    backSkinId: 'skin_default',
    seed,
    startedAt: Date.now(),
  });

  const { data: inserted } = await db
    .from('games')
    .insert({ id: game.id, room_id: roomId, status: game.status, version: 0, state: game })
    .select()
    .single();
  await db.from('rooms').update({ game_id: game.id, status: 'in_progress' }).eq('id', roomId);

  return json(inserted, 200);
}

const FALLBACK_PHRASE = {
  id: 'proverb_001',
  category: 'أمثال',
  fullText: 'ما خاب من استشار',
  words: ['ما', 'خاب', 'من', 'استشار'],
  difficulty: 'easy',
  sourceType: 'proverb',
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
