import { useState } from 'react';
import { motion } from 'framer-motion';
import { ar } from '../../../i18n/ar';

interface Props {
  sequence: string[];
  palette: string[];
  /** Server time after which the prompt is hidden and input opens. */
  showUntil: number;
  now: number;
  disabled: boolean;
  onSubmit: (paletteIndices: number[]) => void;
}

/**
 * Memorize a run of symbols, then reproduce it. The answer is submitted as
 * palette indices so the host can score it without trusting any text sent by
 * the device.
 */
export function SequenceMemory({
  sequence,
  palette,
  showUntil,
  now,
  disabled,
  onSubmit,
}: Props): JSX.Element {
  const [picked, setPicked] = useState<number[]>([]);
  const memorizing = now < showUntil;
  const full = picked.length >= sequence.length;

  if (memorizing) {
    return (
      <div className="flex w-full flex-col items-center gap-5">
        <p className="font-display text-xl text-cream/70">{ar.challenge.sequenceWatch}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {sequence.map((symbol, index) => (
            <motion.span
              key={index}
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: index * 0.12, type: 'spring', stiffness: 500, damping: 16 }}
              className="rounded-chunk bg-pop-yellow px-4 py-3 font-display text-xl font-black text-ink-950"
            >
              {symbol}
            </motion.span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="font-display text-xl text-cream/70">{ar.challenge.sequenceRepeat}</p>

      {/* Slots fill right-to-left, matching the reading direction. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {sequence.map((_, index) => (
          <span
            key={index}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${
              picked[index] !== undefined
                ? 'bg-pop-mint text-ink-950'
                : 'bg-ink-800 text-cream/25'
            }`}
          >
            {picked[index] !== undefined ? palette[picked[index] as number] : '·'}
          </span>
        ))}
      </div>

      <div className="grid w-full grid-cols-3 gap-2">
        {palette.map((symbol, index) => (
          <motion.button
            key={symbol}
            type="button"
            disabled={disabled || full}
            whileTap={{ scale: 0.92 }}
            onClick={() => setPicked((prev) => [...prev, index])}
            className="btn-secondary min-h-[60px] text-lg"
          >
            {symbol}
          </motion.button>
        ))}
      </div>

      <div className="flex w-full gap-3">
        <button
          type="button"
          className="btn-ghost flex-1"
          disabled={disabled || picked.length === 0}
          onClick={() => setPicked([])}
        >
          {ar.challenge.sequenceClear}
        </button>
        <button
          type="button"
          className="btn-primary flex-[2]"
          disabled={disabled || !full}
          onClick={() => onSubmit(picked)}
        >
          {ar.challenge.submit}
        </button>
      </div>
    </div>
  );
}
