import { describe, expect, it } from 'vitest';
import { reduce } from './engine';
import { generateDeck } from './deck';
import { allMatched, playerScore } from './selectors';
import {
  makeGame,
  matchingPair,
  mismatchedPair,
  soloConfig,
  TEST_PHRASE,
  wordPair,
} from './testFixtures';

const NOW = 2_000;

describe('deck generation', () => {
  it('creates pairCount * 2 cards with two of each pair', () => {
    const deck = generateDeck({
      phrase: TEST_PHRASE,
      pairCount: 6,
      backSkinId: 'skin_default',
      seed: 1,
    });
    expect(deck).toHaveLength(12);
    const counts = new Map<string, number>();
    for (const c of deck) counts.set(c.pairId, (counts.get(c.pairId) ?? 0) + 1);
    for (const count of counts.values()) expect(count).toBe(2);
  });

  it('is deterministic for a given seed and assigns unique positions', () => {
    const a = generateDeck({ phrase: TEST_PHRASE, pairCount: 6, backSkinId: 's', seed: 42 });
    const b = generateDeck({ phrase: TEST_PHRASE, pairCount: 6, backSkinId: 's', seed: 42 });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(new Set(a.map((c) => c.position)).size).toBe(a.length);
  });

  it('maps the first N pairs to phrase words and the rest to decoys', () => {
    const deck = generateDeck({ phrase: TEST_PHRASE, pairCount: 6, backSkinId: 's', seed: 1 });
    const withWords = new Set(deck.filter((c) => c.revealedWordId).map((c) => c.pairId));
    expect(withWords.size).toBe(TEST_PHRASE.words.length); // 4 words
  });
});

describe('matching + scoring', () => {
  it('marks a matched pair, awards score, and reveals a word', () => {
    let game = makeGame();
    const [a, b] = wordPair(game);

    game = expectOk(reduce(game, { type: 'SELECT_CARD', playerId: 'p1', cardId: a }, soloConfig(), NOW));
    game = expectOk(reduce(game, { type: 'SELECT_CARD', playerId: 'p1', cardId: b }, soloConfig(), NOW));

    expect(game.phase).toBe('resolving');
    expect(game.deck.find((c) => c.id === a)?.isMatched).toBe(true);
    expect(playerScore(game, 'p1')).toBe(soloConfig().matchScore);
    expect(game.revealedWords).toHaveLength(1);
  });

  it('does not award score for a mismatch and hides cards on END_REVEAL', () => {
    let game = makeGame();
    const [a, b] = mismatchedPair(game);

    game = expectOk(reduce(game, { type: 'SELECT_CARD', playerId: 'p1', cardId: a }, soloConfig(), NOW));
    game = expectOk(reduce(game, { type: 'SELECT_CARD', playerId: 'p1', cardId: b }, soloConfig(), NOW));
    expect(playerScore(game, 'p1')).toBe(0);

    game = expectOk(reduce(game, { type: 'END_REVEAL', playerId: 'p1' }, soloConfig(), NOW));
    expect(game.deck.find((c) => c.id === a)?.isRevealed).toBe(false);
    expect(game.deck.find((c) => c.id === b)?.isRevealed).toBe(false);
  });
});

describe('turn switching', () => {
  it('passes the turn after a mismatch', () => {
    let game = makeGame(['p1', 'p2']);
    const [a, b] = mismatchedPair(game);
    game = play(game, 'p1', a, b);
    game = expectOk(reduce(game, { type: 'END_REVEAL', playerId: 'p1' }, soloConfig(), NOW));
    expect(game.currentTurnPlayerId).toBe('p2');
  });

  it('keeps the turn after a match when configured to continue', () => {
    const config = soloConfig({ turnAfterMatch: 'continue' });
    let game = makeGame(['p1', 'p2'], config);
    const [a, b] = matchingPair(game);
    game = play(game, 'p1', a, b, config);
    game = expectOk(reduce(game, { type: 'END_REVEAL', playerId: 'p1' }, config, NOW));
    expect(game.currentTurnPlayerId).toBe('p1');
  });

  it('passes the turn after a match when configured to pass', () => {
    const config = soloConfig({ turnAfterMatch: 'pass' });
    let game = makeGame(['p1', 'p2'], config);
    const [a, b] = matchingPair(game);
    game = play(game, 'p1', a, b, config);
    game = expectOk(reduce(game, { type: 'END_REVEAL', playerId: 'p1' }, config, NOW));
    expect(game.currentTurnPlayerId).toBe('p2');
  });
});

describe('invalid move rejection', () => {
  it('rejects a move from the wrong player', () => {
    const game = makeGame(['p1', 'p2']);
    const res = reduce(game, { type: 'SELECT_CARD', playerId: 'p2', cardId: game.deck[0]!.id }, soloConfig(), NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NOT_YOUR_TURN');
  });

  it('rejects selecting the same card twice', () => {
    let game = makeGame();
    const id = game.deck[0]!.id;
    game = expectOk(reduce(game, { type: 'SELECT_CARD', playerId: 'p1', cardId: id }, soloConfig(), NOW));
    const res = reduce(game, { type: 'SELECT_CARD', playerId: 'p1', cardId: id }, soloConfig(), NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CARD_ALREADY_SELECTED');
  });

  it('rejects a third selection in the same turn', () => {
    let game = makeGame();
    const [a, b] = mismatchedPair(game);
    game = play(game, 'p1', a, b);
    const third = game.deck.find((c) => c.id !== a && c.id !== b)!.id;
    const res = reduce(game, { type: 'SELECT_CARD', playerId: 'p1', cardId: third }, soloConfig(), NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('WRONG_PHASE');
  });

  it('rejects selecting an already-matched card', () => {
    const config = soloConfig({ turnAfterMatch: 'continue' });
    let game = makeGame(['p1', 'p2'], config);
    const [a, b] = matchingPair(game);
    game = play(game, 'p1', a, b, config);
    game = expectOk(reduce(game, { type: 'END_REVEAL', playerId: 'p1' }, config, NOW));
    const res = reduce(game, { type: 'SELECT_CARD', playerId: 'p1', cardId: a }, config, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CARD_ALREADY_MATCHED');
  });

  it('rejects any move after the game has ended', () => {
    let game = makeGame();
    game = expectOk(reduce(game, { type: 'SOLVE_PHRASE', playerId: 'p1', guess: TEST_PHRASE.fullText }, soloConfig(), NOW));
    expect(game.status).toBe('completed');
    const res = reduce(game, { type: 'SELECT_CARD', playerId: 'p1', cardId: game.deck[0]!.id }, soloConfig(), NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('GAME_NOT_IN_PROGRESS');
  });
});

describe('phrase solving', () => {
  it('wins instantly on a correct guess (with normalization)', () => {
    let game = makeGame();
    const res = reduce(game, { type: 'SOLVE_PHRASE', playerId: 'p1', guess: '  ما خاب من استشار  ' }, soloConfig(), NOW);
    game = expectOk(res);
    expect(game.status).toBe('completed');
    expect(game.winnerId).toBe('p1');
    expect(game.endedAt).toBe(NOW);
  });

  it('applies skip-next-turn penalty on a wrong guess', () => {
    const config = soloConfig({ wrongSolvePenalty: 'skip_next_turn' });
    let game = makeGame(['p1', 'p2'], config);
    game = expectOk(reduce(game, { type: 'SOLVE_PHRASE', playerId: 'p1', guess: 'خطأ' }, config, NOW));
    expect(game.currentTurnPlayerId).toBe('p2'); // turn passed
    expect(game.attempts.find((a) => a.playerId === 'p1')?.attemptsUsed).toBe(1);

    // p2 mismatches and passes; the skip should make it skip p1 back to p2.
    const [a, b] = mismatchedPair(game);
    game = play(game, 'p2', a, b, config);
    game = expectOk(reduce(game, { type: 'END_REVEAL', playerId: 'p2' }, config, NOW));
    expect(game.currentTurnPlayerId).toBe('p2');
  });

  it('reduces score on wrong guess when configured', () => {
    const config = soloConfig({ wrongSolvePenalty: 'reduce_score', wrongSolveScorePenalty: 50 });
    let game = makeGame(['p1', 'p2'], config);
    // give p1 some score first
    const [a, b] = wordPair(game);
    game = play(game, 'p1', a, b, config);
    game = expectOk(reduce(game, { type: 'END_REVEAL', playerId: 'p1' }, config, NOW));
    const before = playerScore(game, 'p1');
    // back to p1 eventually; force p1 turn by checking current
    if (game.currentTurnPlayerId !== 'p1') {
      // pass p2
      const [c, d] = mismatchedPair(game);
      game = play(game, 'p2', c, d, config);
      game = expectOk(reduce(game, { type: 'END_REVEAL', playerId: 'p2' }, config, NOW));
    }
    game = expectOk(reduce(game, { type: 'SOLVE_PHRASE', playerId: 'p1', guess: 'لا' }, config, NOW));
    expect(playerScore(game, 'p1')).toBe(Math.max(0, before - 50));
  });
});

describe('end of game by score', () => {
  it('completes and picks the higher score when all pairs match', () => {
    const config = soloConfig({ turnAfterMatch: 'continue', pairCount: 6 });
    let game = makeGame(['p1', 'p2'], config);
    // p1 matches every pair in sequence.
    const pairs = groupPairs(game);
    for (const [a, b] of pairs) {
      game = play(game, 'p1', a, b, config);
      game = expectOk(reduce(game, { type: 'END_REVEAL', playerId: 'p1' }, config, NOW));
    }
    expect(allMatched(game)).toBe(true);
    expect(game.status).toBe('completed');
    expect(game.winnerId).toBe('p1');
  });
});

// --- helpers ---------------------------------------------------------------

function expectOk(res: ReturnType<typeof reduce>) {
  if (!res.ok) throw new Error(`expected ok, got ${res.error.code}: ${res.error.message}`);
  return res.value.game;
}

function play(
  game: Parameters<typeof reduce>[0],
  playerId: string,
  a: string,
  b: string,
  config = soloConfig(),
) {
  let g = expectOk(reduce(game, { type: 'SELECT_CARD', playerId, cardId: a }, config, NOW));
  g = expectOk(reduce(g, { type: 'SELECT_CARD', playerId, cardId: b }, config, NOW));
  return g;
}

function groupPairs(game: ReturnType<typeof makeGame>): Array<[string, string]> {
  const byPair = new Map<string, string[]>();
  for (const c of game.deck) {
    const list = byPair.get(c.pairId) ?? [];
    list.push(c.id);
    byPair.set(c.pairId, list);
  }
  return [...byPair.values()].map((ids) => [ids[0]!, ids[1]!] as [string, string]);
}
