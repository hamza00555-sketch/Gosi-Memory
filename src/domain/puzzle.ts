import type { PuzzleId } from './ids';

/** Authored form, in puzzles.json. */
export interface PuzzleDefinition {
  id: PuzzleId;
  /** Arabic question shown above the answer options. */
  prompt: string;
  image: string;
  /** How many covering tiles hide the image. Matched pairs reveal one each. */
  pieceCount: number;
  /** Exactly four options. */
  options: string[];
  correctAnswer: number;
}

/**
 * Each team has its own puzzle, visible only on its own device. Pieces are
 * revealed in a seeded order so a refresh or a late-joining device rebuilds the
 * exact same board.
 */
export interface TeamPuzzleState {
  puzzleId: PuzzleId;
  /** Seeded permutation of tile indices; pieces reveal along this order. */
  revealOrder: number[];
  /** Number of tiles revealed so far — the prefix of revealOrder that is open. */
  revealedCount: number;
  solved: boolean;
  /** Set after a wrong guess; cleared when this team's turn comes around again. */
  lockedUntilNextTurn: boolean;
  attempts: number;
  /**
   * Position in this team's seeded puzzle rota. The two teams draw from
   * interleaved halves of one shuffled list, so they never share a puzzle and
   * a reconnecting device rebuilds the same one.
   */
  sequenceIndex: number;
}

export const PUZZLE_CORRECT_SCORE = 200;
export const PUZZLE_WRONG_PENALTY = 50;

/** Indices of the tiles currently lifted off the image. */
export function revealedPieces(state: TeamPuzzleState): number[] {
  return state.revealOrder.slice(0, state.revealedCount);
}

export function isPieceRevealed(state: TeamPuzzleState, pieceIndex: number): boolean {
  return state.revealOrder.indexOf(pieceIndex) < state.revealedCount;
}
