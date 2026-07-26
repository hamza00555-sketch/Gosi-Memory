import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getPuzzle } from '../../content';
import type { TeamPuzzleState } from '../../domain/puzzle';
import { isPieceRevealed } from '../../domain/puzzle';
import { ar } from '../../i18n/ar';

interface Props {
  puzzle: TeamPuzzleState;
  /** False for the watching team — they see the board but cannot answer. */
  canAnswer: boolean;
  onAnswer: (index: number) => void;
  onClose: () => void;
}

/**
 * A team's private picture puzzle. Each matched pair lifts one tile; the team
 * may gamble on the answer during its own turn for +200, or −50 if wrong.
 */
export default function PuzzleOverlay({
  puzzle,
  canAnswer,
  onAnswer,
  onClose,
}: Props): JSX.Element | null {
  const definition = getPuzzle(puzzle.puzzleId);
  const [picked, setPicked] = useState<number | null>(null);

  const grid = useMemo(() => {
    if (!definition) return { cols: 3, rows: 3 };
    const cols = Math.ceil(Math.sqrt(definition.pieceCount));
    return { cols, rows: Math.ceil(definition.pieceCount / cols) };
  }, [definition]);

  if (!definition) return null;

  const submit = (index: number): void => {
    if (!canAnswer || picked !== null) return;
    setPicked(index);
    onAnswer(index);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex flex-col bg-ink-950/96 backdrop-blur-sm"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <header className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-2xl text-pop-yellow">{ar.puzzle.title}</h2>
        <button type="button" onClick={onClose} className="hud-chip" aria-label={ar.common.close}>
          {ar.common.close}
        </button>
      </header>

      <div className="px-5 pt-4">
        <div
          className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-chunk bg-ink-800"
          role="img"
          aria-label={definition.prompt}
        >
          <img
            src={definition.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
            /* The picture may not ship yet; the tiles alone still convey progress. */
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
          />
          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: definition.pieceCount }, (_, index) => {
              const open = isPieceRevealed(puzzle, index);
              return (
                <motion.div
                  key={index}
                  initial={false}
                  animate={{ opacity: open ? 0 : 1, scale: open ? 1.15 : 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className="border border-ink-950/40 bg-ink-700"
                />
              );
            })}
          </div>
        </div>

        <p className="pt-3 text-center text-sm text-cream/50">
          {ar.puzzle.piecesRevealed}:{' '}
          <span className="nums">
            {puzzle.revealedCount}/{definition.pieceCount}
          </span>
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-3 px-5 pb-5 pt-5">
        <p className="text-center text-lg text-cream/80">{definition.prompt}</p>

        <AnimatePresence>
          {!canAnswer && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm text-cream/50"
            >
              {ar.puzzle.lockedNow}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-3">
          {definition.options.map((label, index) => (
            <motion.button
              key={label}
              type="button"
              whileTap={{ scale: 0.94 }}
              disabled={!canAnswer || picked !== null}
              onClick={() => submit(index)}
              className={`btn min-h-[68px] text-lg ${
                picked === index ? 'bg-pop-yellow text-ink-950' : 'bg-ink-700 text-cream'
              }`}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
