import { PUZZLES, getPuzzle } from '../../content';
import type { TeamId } from '../../domain/ids';
import type { PuzzleDefinition, TeamPuzzleState } from '../../domain/puzzle';
import { createRng, deriveSeed, shuffle } from './rng';

/**
 * Both teams draw from a single seeded shuffle of the puzzle pack, teamA taking
 * the even slots and teamB the odd ones. That guarantees the two teams never
 * work on the same picture while keeping the whole rota reproducible from the
 * match seed alone.
 */
function rotaFor(seed: number, teamId: TeamId): PuzzleDefinition[] {
  const shuffled = shuffle(PUZZLES, createRng(deriveSeed(seed, 0x9021)));
  const offset = teamId === 'teamA' ? 0 : 1;
  const rota = shuffled.filter((_, index) => index % 2 === offset);
  // With an odd pack size one half can come up empty only if the pack has a
  // single puzzle; fall back to the full list so a team is never left without.
  return rota.length > 0 ? rota : shuffled;
}

export function puzzleAt(seed: number, teamId: TeamId, sequenceIndex: number): PuzzleDefinition {
  const rota = rotaFor(seed, teamId);
  return rota[sequenceIndex % rota.length] as PuzzleDefinition;
}

/** A fresh, fully covered puzzle board for a team. */
export function createTeamPuzzle(
  seed: number,
  teamId: TeamId,
  sequenceIndex: number,
): TeamPuzzleState {
  const definition = puzzleAt(seed, teamId, sequenceIndex);
  const rng = createRng(deriveSeed(seed, sequenceIndex, teamId === 'teamA' ? 1 : 2));
  const order = shuffle(
    Array.from({ length: definition.pieceCount }, (_, i) => i),
    rng,
  );
  return {
    puzzleId: definition.id,
    revealOrder: order,
    revealedCount: 0,
    solved: false,
    lockedUntilNextTurn: false,
    attempts: 0,
    sequenceIndex,
  };
}

/** Lift one more tile. Saturates once the whole image is exposed. */
export function revealNextPiece(state: TeamPuzzleState): TeamPuzzleState {
  if (state.revealedCount >= state.revealOrder.length) return state;
  return { ...state, revealedCount: state.revealedCount + 1 };
}

export function puzzleDefinitionFor(state: TeamPuzzleState): PuzzleDefinition | undefined {
  return getPuzzle(state.puzzleId);
}
