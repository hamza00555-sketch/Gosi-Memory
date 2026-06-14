import { describe, expect, it } from 'vitest';
import { chooseCards, createAiMemory, observeBoard, playAiTurn } from './ai';
import { makeGame, soloConfig } from '../engine/testFixtures';
import { createRng } from '../utils/rng';
import type { AiMemory } from './ai';

function fullMemory(game: ReturnType<typeof makeGame>): AiMemory {
  const memory = createAiMemory();
  for (const c of game.deck) memory.set(c.id, c.pairId);
  return memory;
}

describe('AI move selection', () => {
  it('completes a known pair when both cards are remembered', () => {
    const game = makeGame(['ai_bot', 'p2']);
    const memory = fullMemory(game);
    const choice = chooseCards(game, memory, createRng(1));
    expect(choice).not.toBeNull();
    const a = game.deck.find((c) => c.id === choice!.first)!;
    const b = game.deck.find((c) => c.id === choice!.second)!;
    expect(a.pairId).toBe(b.pairId);
  });

  it('never picks the same card twice', () => {
    const game = makeGame(['ai_bot', 'p2']);
    const memory = createAiMemory(); // empty -> exploration path
    for (let i = 0; i < 20; i++) {
      const choice = chooseCards(game, memory, createRng(i));
      expect(choice).not.toBeNull();
      expect(choice!.first).not.toBe(choice!.second);
    }
  });

  it('hard AI with full memory clears the whole board in one turn', () => {
    const config = soloConfig({ turnAfterMatch: 'continue' });
    const game = makeGame(['ai_bot', 'p2'], config);
    const memory = fullMemory(game);
    const final = playAiTurn(game, config, memory, 'hard', createRng(7), () => 5000);
    expect(final.status).toBe('completed');
    expect(final.deck.every((c) => c.isMatched)).toBe(true);
  });

  it('easy AI still produces only legal progress', () => {
    const config = soloConfig({ turnAfterMatch: 'pass' });
    const game = makeGame(['ai_bot', 'p2'], config);
    const memory = createAiMemory();
    const final = playAiTurn(game, config, memory, 'easy', createRng(3), () => 5000);
    // Either it matched (kept turn impossible since pass) or it passed the turn.
    expect(final.version).toBeGreaterThan(game.version);
    expect(['ai_bot', 'p2']).toContain(final.currentTurnPlayerId);
  });

  it('retains more cards on higher difficulty', () => {
    const game = makeGame();
    // Reveal the whole board so observeBoard considers every card.
    const revealed = { ...game, deck: game.deck.map((c) => ({ ...c, isRevealed: true })) };

    const easy = createAiMemory();
    const hard = createAiMemory();
    observeBoard(easy, revealed, 'easy', createRng(11));
    observeBoard(hard, revealed, 'hard', createRng(11));
    expect(hard.size).toBeGreaterThanOrEqual(easy.size);
  });
});
