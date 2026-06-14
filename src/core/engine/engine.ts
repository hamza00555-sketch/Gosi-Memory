import type { GameConfig } from '../types/config';
import type { AttemptState, Game, ScoreEntry } from '../types/game';
import type { EpochMs, GameId, PlayerId, RoomId, TeamId, WordId } from '../types/ids';
import type { Phrase } from '../types/phrase';
import type { GameMode } from '../types/room';
import { phrasesMatch } from '../utils/arabic';
import type { GameAction, GameEvent } from './actions';
import { generateDeck } from './deck';
import { err, moveError, ok, type Result } from './errors';
import {
  allMatched,
  findCard,
  teamIds,
  teamOf,
  teamScore,
} from './selectors';

export interface InitGameParams {
  id: GameId;
  roomId: RoomId;
  mode: GameMode;
  config: GameConfig;
  phrase: Phrase;
  /** Turn order; for 2v2 this should already interleave the two teams. */
  turnOrder: PlayerId[];
  /** playerId -> teamId. Empty/omitted for solo & 1v1 (teamId stays null). */
  teamByPlayer?: Record<PlayerId, TeamId>;
  backSkinId: string;
  seed: number;
  startedAt: EpochMs;
}

export interface ReduceOutput {
  game: Game;
  events: GameEvent[];
}

/** Build a fresh, valid game snapshot. Pure given its inputs. */
export function initGame(params: InitGameParams): Game {
  const {
    id,
    roomId,
    mode,
    config,
    phrase,
    turnOrder,
    teamByPlayer = {},
    backSkinId,
    seed,
    startedAt,
  } = params;

  const deck = generateDeck({
    phrase,
    pairCount: config.pairCount,
    backSkinId,
    seed,
  });

  const scores: ScoreEntry[] = turnOrder.map((playerId) => ({
    playerId,
    teamId: teamByPlayer[playerId] ?? null,
    score: 0,
    matchedPairs: 0,
  }));

  const attempts: AttemptState[] = turnOrder.map((playerId) => ({
    playerId,
    attemptsUsed: 0,
    skipTurns: 0,
  }));

  const firstPlayer = turnOrder[0]!;

  return {
    id,
    roomId,
    mode,
    status: 'in_progress',
    phase: 'selecting_first',
    seed,
    version: 0,
    turnIndex: 0,
    currentTurnPlayerId: firstPlayer,
    currentTeamId: teamByPlayer[firstPlayer] ?? null,
    turnOrder,
    deck,
    selection: [],
    hiddenPhrase: phrase,
    revealedWords: [],
    scores,
    attempts,
    winnerId: null,
    winnerTeamId: null,
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
      return handleSelectCard(game, action.playerId, action.cardId, config);
    case 'END_REVEAL':
      return handleEndReveal(game, action.playerId, config, now);
    case 'SOLVE_PHRASE':
      return handleSolve(game, action.playerId, action.guess, config, now);
    case 'TIMEOUT':
      return handleTimeout(game, action.playerId, config);
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
  playerId: PlayerId,
  cardId: string,
  config: GameConfig,
): Result<ReduceOutput> {
  const guard = ensureActiveTurn(game, playerId);
  if (guard) return err(guard);

  if (game.phase !== 'selecting_first' && game.phase !== 'selecting_second') {
    return err(moveError('WRONG_PHASE', 'لا يمكن اختيار بطاقة الآن.'));
  }

  const card = findCard(game, cardId);
  if (!card) return err(moveError('CARD_NOT_FOUND', 'البطاقة غير موجودة.'));
  if (card.isMatched) {
    return err(moveError('CARD_ALREADY_MATCHED', 'هذه البطاقة مطابَقة بالفعل.'));
  }
  if (game.selection.includes(cardId)) {
    return err(moveError('CARD_ALREADY_SELECTED', 'تم اختيار هذه البطاقة بالفعل.'));
  }
  if (game.selection.length >= 2) {
    return err(moveError('TOO_MANY_SELECTED', 'تم اختيار بطاقتين بالفعل.'));
  }

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

  if (!isMatch) {
    events.push({ type: 'PAIR_MISSED', cardIds: [firstId, secondId], by: playerId });
    return ok({
      game: bump(game, { deck, selection, phase: 'resolving' }),
      events,
    });
  }

  // Match: mark matched, score, reveal a word.
  const matchedDeck = deck.map((c) =>
    c.id === firstId || c.id === secondId ? { ...c, isMatched: true } : c,
  );
  const scores = addScore(game.scores, playerId, config.matchScore);
  events.push({
    type: 'PAIR_MATCHED',
    cardIds: [firstId, secondId],
    by: playerId,
    points: config.matchScore,
  });

  let revealedWords = game.revealedWords;
  if (first.revealedWordId && !revealedWords.includes(first.revealedWordId)) {
    revealedWords = [...revealedWords, first.revealedWordId as WordId];
    events.push({ type: 'WORD_REVEALED', wordId: first.revealedWordId });
  }

  return ok({
    game: bump(game, {
      deck: matchedDeck,
      selection,
      phase: 'resolving',
      scores,
      revealedWords,
    }),
    events,
  });
}

function handleEndReveal(
  game: Game,
  playerId: PlayerId,
  config: GameConfig,
  now: EpochMs,
): Result<ReduceOutput> {
  const guard = ensureActiveTurn(game, playerId);
  if (guard) return err(guard);
  if (game.phase !== 'resolving') {
    return err(moveError('WRONG_PHASE', 'لا يوجد كشف قيد الانتظار.'));
  }

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
  const passed = passTurn({ ...bump(game, { deck, selection: [], phase: 'selecting_first' }) });
  events.push({ type: 'TURN_PASSED', from: playerId, to: passed.currentTurnPlayerId });
  return ok({ game: passed, events });
}

function handleSolve(
  game: Game,
  playerId: PlayerId,
  guess: string,
  config: GameConfig,
  now: EpochMs,
): Result<ReduceOutput> {
  const guard = ensureActiveTurn(game, playerId);
  if (guard) return err(guard);
  if (game.phase === 'resolving') {
    return err(moveError('WRONG_PHASE', 'أنهِ كشف البطاقات أولاً.'));
  }
  if (guess.trim().length === 0) {
    return err(moveError('EMPTY_GUESS', 'اكتب الجملة قبل المحاولة.'));
  }

  const attempt = game.attempts.find((a) => a.playerId === playerId)!;
  if (
    config.wrongSolvePenalty === 'consume_attempt' &&
    attempt.attemptsUsed >= config.maxSolveAttempts
  ) {
    return err(moveError('NO_ATTEMPTS_LEFT', 'لا توجد محاولات متبقية.'));
  }

  const correct = phrasesMatch(guess, game.hiddenPhrase.fullText);

  if (correct) {
    const scores = addScore(game.scores, playerId, config.solveBonus);
    const teamId = teamOf(game, playerId);
    const finished: Game = {
      ...bump(game, { scores }),
      status: 'completed',
      phase: 'completed',
      winnerId: teamId ? null : playerId,
      winnerTeamId: teamId,
      endedAt: now,
    };
    return ok({
      game: finished,
      events: [
        { type: 'PHRASE_SOLVED', by: playerId },
        { type: 'GAME_COMPLETED', winnerId: finished.winnerId },
      ],
    });
  }

  // Wrong guess: record attempt + apply the configured penalty, then pass turn.
  const attempts = game.attempts.map((a) =>
    a.playerId === playerId
      ? {
          ...a,
          attemptsUsed: a.attemptsUsed + 1,
          skipTurns:
            config.wrongSolvePenalty === 'skip_next_turn'
              ? a.skipTurns + 1
              : a.skipTurns,
        }
      : a,
  );
  let scores = game.scores;
  if (config.wrongSolvePenalty === 'reduce_score') {
    scores = addScore(game.scores, playerId, -config.wrongSolveScorePenalty);
  }

  const passed = passTurn({
    ...bump(game, { attempts, scores, selection: [], phase: 'selecting_first' }),
  });
  // hide any revealed-but-unmatched cards from the abandoned selection
  const cleanedDeck = passed.deck.map((c) =>
    !c.isMatched && c.isRevealed ? { ...c, isRevealed: false } : c,
  );
  return ok({
    game: { ...passed, deck: cleanedDeck },
    events: [
      { type: 'SOLVE_FAILED', by: playerId, penalty: config.wrongSolvePenalty },
      { type: 'TURN_PASSED', from: playerId, to: passed.currentTurnPlayerId },
    ],
  });
}

function handleTimeout(
  game: Game,
  playerId: PlayerId,
  _config: GameConfig,
): Result<ReduceOutput> {
  const guard = ensureActiveTurn(game, playerId);
  if (guard) return err(guard);

  const deck = game.deck.map((c) =>
    !c.isMatched && c.isRevealed ? { ...c, isRevealed: false } : c,
  );
  const passed = passTurn({
    ...bump(game, { deck, selection: [], phase: 'selecting_first' }),
  });
  return ok({
    game: passed,
    events: [{ type: 'TURN_PASSED', from: playerId, to: passed.currentTurnPlayerId }],
  });
}

// ----------------------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------------------

function ensureActiveTurn(game: Game, playerId: PlayerId) {
  if (game.status !== 'in_progress') {
    return moveError('GAME_NOT_IN_PROGRESS', 'انتهت اللعبة.');
  }
  if (game.currentTurnPlayerId !== playerId) {
    return moveError('NOT_YOUR_TURN', 'ليس دورك.');
  }
  return null;
}

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

/** Advance to the next eligible player, consuming any pending skip turns. */
function passTurn(game: Game): Game {
  const order = game.turnOrder;
  const currentIdx = order.indexOf(game.currentTurnPlayerId);
  let attempts = game.attempts;
  let nextIdx = currentIdx;

  for (let step = 0; step < order.length; step++) {
    nextIdx = (nextIdx + 1) % order.length;
    const candidate = order[nextIdx]!;
    const a = attempts.find((x) => x.playerId === candidate)!;
    if (a.skipTurns > 0) {
      attempts = attempts.map((x) =>
        x.playerId === candidate ? { ...x, skipTurns: x.skipTurns - 1 } : x,
      );
      continue; // this player skips; keep looking
    }
    return {
      ...game,
      attempts,
      currentTurnPlayerId: candidate,
      currentTeamId: teamOf(game, candidate),
      turnIndex: game.turnIndex + 1,
    };
  }

  // Everyone is skipped (degenerate); keep current player to avoid a deadlock.
  return { ...game, attempts, turnIndex: game.turnIndex + 1 };
}

/** Finalize a game when all pairs are matched: highest score (or team) wins. */
function completeByScore(
  game: Game,
  events: GameEvent[],
  now: EpochMs,
): ReduceOutput {
  const teams = teamIds(game);
  let winnerId: PlayerId | null = null;
  let winnerTeamId: TeamId | null = null;

  if (teams.length > 0) {
    let best = -Infinity;
    let tie = false;
    for (const t of teams) {
      const s = teamScore(game, t);
      if (s > best) {
        best = s;
        winnerTeamId = t;
        tie = false;
      } else if (s === best) {
        tie = true;
      }
    }
    if (tie) winnerTeamId = null;
  } else {
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
    if (tie) winnerId = null;
  }

  const finished: Game = {
    ...game,
    status: 'completed',
    phase: 'completed',
    winnerId,
    winnerTeamId,
    endedAt: game.endedAt ?? now,
  };
  events.push({ type: 'GAME_COMPLETED', winnerId });
  return { game: finished, events };
}
