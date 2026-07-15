import { describe, expect, it } from 'vitest';
import type { Game } from '../types/game';
import type { GameConfig } from '../types/config';
import { reduce } from './engine';
import {
  makeGame,
  matchingPair,
  mismatchedPair,
  passPlayConfig,
  soloConfig,
  TEST_PAIRS,
} from './testFixtures';

const NOW = 2_000;

function apply(game: Game, config: GameConfig, cardId: string) {
  const res = reduce(game, { type: 'SELECT_CARD', cardId }, config, NOW);
  expect(res.ok, res.ok ? '' : res.error.message).toBe(true);
  return res.ok ? res.value : (undefined as never);
}

function endReveal(game: Game, config: GameConfig) {
  const res = reduce(game, { type: 'END_REVEAL' }, config, NOW);
  expect(res.ok, res.ok ? '' : res.error.message).toBe(true);
  return res.ok ? res.value : (undefined as never);
}

describe('initGame', () => {
  it('builds two cards per pair, all face-down', () => {
    const game = makeGame();
    expect(game.deck).toHaveLength(TEST_PAIRS.length * 2);
    expect(game.deck.every((c) => !c.isRevealed && !c.isMatched)).toBe(true);
    expect(game.phase).toBe('selecting_first');
    expect(game.currentTurnPlayerId).toBe('p1');
  });

  it('derives card ids from pair + side, matching the QR payload scheme', () => {
    const game = makeGame();
    expect(game.deck.map((c) => c.id)).toContain('pair_crab:a');
    expect(game.deck.map((c) => c.id)).toContain('pair_crab:b');
  });
});

describe('SELECT_CARD', () => {
  it('flips the first card and waits for the second', () => {
    const game = makeGame();
    const [a] = matchingPair(game);
    const { game: g2, events } = apply(game, passPlayConfig(), a);
    expect(g2.phase).toBe('selecting_second');
    expect(g2.selection).toEqual([a]);
    expect(events).toEqual([{ type: 'CARD_REVEALED', cardId: a }]);
  });

  it('detects a match, scores it, and enters resolving', () => {
    const config = passPlayConfig();
    const game = makeGame();
    const [a, b] = matchingPair(game);
    const { game: g2 } = apply(game, config, a);
    const { game: g3, events } = apply(g2, config, b);
    expect(g3.phase).toBe('resolving');
    expect(g3.deck.filter((c) => c.isMatched)).toHaveLength(2);
    expect(g3.scores.find((s) => s.playerId === 'p1')!.score).toBe(config.matchScore);
    expect(events.some((e) => e.type === 'PAIR_MATCHED')).toBe(true);
    expect(g3.moveCount).toBe(1);
  });

  it('detects a mismatch without scoring', () => {
    const config = passPlayConfig();
    const game = makeGame();
    const [a, b] = mismatchedPair(game);
    const { game: g2 } = apply(game, config, a);
    const { game: g3, events } = apply(g2, config, b);
    expect(g3.phase).toBe('resolving');
    expect(g3.deck.every((c) => !c.isMatched)).toBe(true);
    expect(g3.scores.every((s) => s.score === 0)).toBe(true);
    expect(events.some((e) => e.type === 'PAIR_MISSED')).toBe(true);
  });

  it('rejects unknown cards (wrong set / foreign QR)', () => {
    const res = reduce(
      makeGame(),
      { type: 'SELECT_CARD', cardId: 'pair_ghost:a' },
      passPlayConfig(),
      NOW,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CARD_NOT_FOUND');
  });

  it('rejects re-selecting the same physical card', () => {
    const config = passPlayConfig();
    const game = makeGame();
    const [a] = matchingPair(game);
    const { game: g2 } = apply(game, config, a);
    const res = reduce(g2, { type: 'SELECT_CARD', cardId: a }, config, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CARD_ALREADY_SELECTED');
  });

  it('rejects selecting a third card while resolving', () => {
    const config = passPlayConfig();
    const game = makeGame();
    const [a, b] = mismatchedPair(game);
    const { game: g2 } = apply(game, config, a);
    const { game: g3 } = apply(g2, config, b);
    const other = g3.deck.find((c) => !g3.selection.includes(c.id))!;
    const res = reduce(g3, { type: 'SELECT_CARD', cardId: other.id }, config, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('WRONG_PHASE');
  });

  it('rejects an already-matched card', () => {
    const config = passPlayConfig();
    let game = makeGame();
    const [a, b] = matchingPair(game);
    game = apply(game, config, a).game;
    game = apply(game, config, b).game;
    game = endReveal(game, config).game;
    const res = reduce(game, { type: 'SELECT_CARD', cardId: a }, config, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CARD_ALREADY_MATCHED');
  });
});

describe('END_REVEAL + turns', () => {
  it('keeps the turn after a match when configured to continue', () => {
    const config = passPlayConfig({ turnAfterMatch: 'continue' });
    let game = makeGame();
    const [a, b] = matchingPair(game);
    game = apply(game, config, a).game;
    game = apply(game, config, b).game;
    const { game: g4 } = endReveal(game, config);
    expect(g4.currentTurnPlayerId).toBe('p1');
    expect(g4.phase).toBe('selecting_first');
    expect(g4.selection).toEqual([]);
  });

  it('passes the turn after a mismatch and hides the cards again', () => {
    const config = passPlayConfig();
    let game = makeGame();
    const [a, b] = mismatchedPair(game);
    game = apply(game, config, a).game;
    game = apply(game, config, b).game;
    const { game: g4, events } = endReveal(game, config);
    expect(g4.currentTurnPlayerId).toBe('p2');
    expect(g4.deck.every((c) => !c.isRevealed)).toBe(true);
    expect(events.some((e) => e.type === 'TURN_PASSED')).toBe(true);
  });

  it('rotates through more than two players', () => {
    const config = passPlayConfig();
    let game = makeGame(['p1', 'p2', 'p3']);
    for (const expected of ['p2', 'p3', 'p1']) {
      const [a, b] = mismatchedPair(game);
      game = apply(game, config, a).game;
      game = apply(game, config, b).game;
      game = endReveal(game, config).game;
      expect(game.currentTurnPlayerId).toBe(expected);
    }
  });

  it('solo keeps the same player after a mismatch', () => {
    const config = soloConfig({ turnAfterMatch: 'continue' });
    let game = makeGame(['solo'], config);
    const [a, b] = mismatchedPair(game);
    game = apply(game, config, a).game;
    game = apply(game, config, b).game;
    const { game: g4, events } = endReveal(game, config);
    expect(g4.currentTurnPlayerId).toBe('solo');
    expect(events.some((e) => e.type === 'TURN_PASSED')).toBe(false);
  });
});

describe('game completion', () => {
  function playFullGame(players: string[]) {
    const config = passPlayConfig();
    let game = makeGame(players);
    for (let i = 0; i < TEST_PAIRS.length; i++) {
      const [a, b] = matchingPair(game, true);
      game = apply(game, config, a).game;
      game = apply(game, config, b).game;
      game = endReveal(game, config).game;
    }
    return game;
  }

  it('completes when all pairs are matched and crowns the top scorer', () => {
    const game = playFullGame(['p1', 'p2']);
    expect(game.status).toBe('completed');
    expect(game.phase).toBe('completed');
    // turnAfterMatch=continue means p1 matched everything.
    expect(game.winnerId).toBe('p1');
    expect(game.endedAt).toBe(NOW);
  });

  it('a solo game always crowns the solo player', () => {
    const game = playFullGame(['solo']);
    expect(game.winnerId).toBe('solo');
    expect(game.moveCount).toBe(TEST_PAIRS.length);
  });

  it('rejects any action after completion', () => {
    const game = playFullGame(['p1']);
    const res = reduce(
      game,
      { type: 'SELECT_CARD', cardId: game.deck[0]!.id },
      passPlayConfig(),
      NOW,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('GAME_NOT_IN_PROGRESS');
  });
});
