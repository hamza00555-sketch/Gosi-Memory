import type { GameConfig } from '../types/config';
import type { Game, ScoreEntry } from '../types/game';
import type { EpochMs, GameId, PairId, PlayerId, SetId } from '../types/ids';
import type { GameAction, GameEvent } from './actions';
import { generateDeck } from './deck';
import { err, moveError, ok, type Result } from './errors';
import { allMatched, findCard } from './selectors';

export interface InitGameParams {
  id: GameId;
  setId: SetId;
  config: GameConfig;
  /** The pairs printed in the physical deck being played. */
  pairIds: readonly PairId[];
  /** Turn order (1 player for solo, 2..4 for pass_play). */
  turnOrder: PlayerId[];
  startedAt: EpochMs;
}

export interface ReduceOutput {
  game: Game;
  events: GameEvent[];
}

/** Build a fresh, valid game snapshot. Pure given its inputs. */
export function initGame(params: InitGameParams): Game {
  const { id, setId, config, pairIds, turnOrder, startedAt } = params;

  const scores: ScoreEntry[] = turnOrder.map((playerId) => ({
    playerId,
    score: 0,
    matchedPairs: 0,
  }));

  return {
    id,
    mode: config.mode,
    setId,
    status: 'in_progress',
    phase: 'selecting_first',
    version: 0,
    turnIndex: 0,
    moveCount: 0,
    currentTurnPlayerId: turnOrder[0]!,
    turnOrder,
    deck: generateDeck(pairIds),
    selection: [],
    scores,
    winnerId: null,
    startedAt,
    endedAt: null,
  };
}

/**
 * The only function that mutates a Game. Returns a NEW snapshot plus the events
 * that occurred, or a typed error if the action is illegal. Never throws on
 * invalid moves — that is what makes invalid moves impossible to apply.
 */
export function reduce(
  game: Game,
  action: GameAction,
  config: GameConfig,
  now: EpochMs,
): Result<ReduceOutput> {
  switch (action.type) {
    case 'SELECT_CARD':
      return handleSelectCard(game, action.cardId, config);
    case 'END_REVEAL':
      return handleEndReveal(game, config, now);
    default: {
      // Exhaustiveness guard.
      const _never: never = action;
      return err(moveError('WRONG_PHASE', `Unknown action ${String(_never)}`));
    }
  }
}

// ----------------------------------------------------------------------------
// Action handlers
// ----------------------------------------------------------------------------

function handleSelectCard(
  game: Game,
  cardId: string,
  config: GameConfig,
): Result<ReduceOutput> {
  if (game.status !== 'in_progress') {
    return err(moveError('GAME_NOT_IN_PROGRESS', 'انتهت اللعبة.'));
  }
  if (game.phase !== 'selecting_first' && game.phase !== 'selecting_second') {
    return err(moveError('WRONG_PHASE', 'لا يمكن كشف بطاقة الآن.'));
  }

  const card = findCard(game, cardId);
  if (!card) return err(moveError('CARD_NOT_FOUND', 'البطاقة ليست من هذه المجموعة.'));
  if (card.isMatched) {
    return err(moveError('CARD_ALREADY_MATCHED', 'هذه البطاقة مطابَقة بالفعل.'));
  }
  if (game.selection.includes(cardId)) {
    return err(moveError('CARD_ALREADY_SELECTED', 'تم كشف هذه البطاقة بالفعل.'));
  }
  if (game.selection.length >= 2) {
    return err(moveError('TOO_MANY_SELECTED', 'تم كشف بطاقتين بالفعل.'));
  }

  const playerId = game.currentTurnPlayerId;
  const events: GameEvent[] = [{ type: 'CARD_REVEALED', cardId }];
  const deck = game.deck.map((c) =>
    c.id === cardId ? { ...c, isRevealed: true } : c,
  );
  const selection = [...game.selection, cardId];

  // First of two cards: just flip and wait for the second.
  if (selection.length === 1) {
    return ok({
      game: bump(game, { deck, selection, phase: 'selecting_second' }),
      events,
    });
  }

  // Second card: resolve match/mismatch now (deterministic from the deck).
  const [firstId, secondId] = selection as [string, string];
  const first = deck.find((c) => c.id === firstId)!;
  const second = deck.find((c) => c.id === secondId)!;
  const isMatch = first.pairId === second.pairId;
  const moveCount = game.moveCount + 1;

  if (!isMatch) {
    events.push({ type: 'PAIR_MISSED', cardIds: [firstId, secondId], by: playerId });
    return ok({
      game: bump(game, { deck, selection, moveCount, phase: 'resolving' }),
      events,
    });
  }

  // Match: mark matched + score.
  const matchedDeck = deck.map((c) =>
    c.id === firstId || c.id === secondId ? { ...c, isMatched: true } : c,
  );
  const scores = addScore(game.scores, playerId, config.matchScore);
  events.push({
    type: 'PAIR_MATCHED',
    cardIds: [firstId, secondId],
    pairId: first.pairId,
    by: playerId,
    points: config.matchScore,
  });

  return ok({
    game: bump(game, {
      deck: matchedDeck,
      selection,
      moveCount,
      phase: 'resolving',
      scores,
    }),
    events,
  });
}

function handleEndReveal(
  game: Game,
  config: GameConfig,
  now: EpochMs,
): Result<ReduceOutput> {
  if (game.status !== 'in_progress') {
    return err(moveError('GAME_NOT_IN_PROGRESS', 'انتهت اللعبة.'));
  }
  if (game.phase !== 'resolving') {
    return err(moveError('WRONG_PHASE', 'لا يوجد كشف قيد الانتظار.'));
  }

  const playerId = game.currentTurnPlayerId;
  const selected = game.selection
    .map((id) => findCard(game, id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const wasMatch = selected.length === 2 && selected.every((c) => c.isMatched);

  // Clear selection; hide any still-revealed non-matched cards.
  const deck = game.deck.map((c) =>
    game.selection.includes(c.id) && !c.isMatched ? { ...c, isRevealed: false } : c,
  );

  const events: GameEvent[] = [];

  // End-of-game: all pairs matched -> decide by score.
  if (allMatched({ ...game, deck })) {
    return ok(completeByScore(bump(game, { deck, selection: [] }), events, now));
  }

  const keepTurn = wasMatch && config.turnAfterMatch === 'continue';
  if (keepTurn) {
    return ok({
      game: bump(game, { deck, selection: [], phase: 'selecting_first' }),
      events,
    });
  }

  // Pass the turn.
  const passed = passTurn(bump(game, { deck, selection: [], phase: 'selecting_first' }));
  if (passed.currentTurnPlayerId !== playerId) {
    events.push({ type: 'TURN_PASSED', from: playerId, to: passed.currentTurnPlayerId });
  }
  return ok({ game: passed, events });
}

// ----------------------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------------------

/** Apply a partial patch + bump the version counter (race guard). */
function bump(game: Game, patch: Partial<Game>): Game {
  return { ...game, ...patch, version: game.version + 1 };
}

function addScore(
  scores: ScoreEntry[],
  playerId: PlayerId,
  delta: number,
): ScoreEntry[] {
  return scores.map((s) =>
    s.playerId === playerId
      ? {
          ...s,
          score: Math.max(0, s.score + delta),
          matchedPairs: delta > 0 ? s.matchedPairs + 1 : s.matchedPairs,
        }
      : s,
  );
}

/** Advance to the next player in rotation (no-op for solo). */
function passTurn(game: Game): Game {
  const order = game.turnOrder;
  if (order.length <= 1) return { ...game, turnIndex: game.turnIndex + 1 };
  const currentIdx = order.indexOf(game.currentTurnPlayerId);
  const next = order[(currentIdx + 1) % order.length]!;
  return {
    ...game,
    currentTurnPlayerId: next,
    turnIndex: game.turnIndex + 1,
  };
}

/** Finalize a game when all pairs are matched: highest score wins. */
function completeByScore(
  game: Game,
  events: GameEvent[],
  now: EpochMs,
): ReduceOutput {
  let winnerId: PlayerId | null = null;
  let best = -Infinity;
  let tie = false;
  for (const s of game.scores) {
    if (s.score > best) {
      best = s.score;
      winnerId = s.playerId;
      tie = false;
    } else if (s.score === best) {
      tie = true;
    }
  }
  if (tie && game.scores.length > 1) winnerId = null;

  const finished: Game = {
    ...game,
    status: 'completed',
    phase: 'completed',
    winnerId,
    endedAt: game.endedAt ?? now,
  };
  events.push({ type: 'GAME_COMPLETED', winnerId });
  return { game: finished, events };
}
