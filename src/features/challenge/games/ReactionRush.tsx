import { motion } from 'framer-motion';
import { ar } from '../../../i18n/ar';

interface Props {
  /** Server time at which the target becomes valid. */
  revealAt: number;
  now: number;
  disabled: boolean;
  /** `early` is true when the press landed before the target appeared. */
  onPress: (early: boolean) => void;
}

/**
 * Press the moment the target lands. Pressing early is reported honestly as a
 * foul — the host would reject it anyway, and admitting it locally lets us show
 * the player why they lost instead of leaving them confused.
 */
export function ReactionRush({ revealAt, now, disabled, onPress }: Props): JSX.Element {
  const live = now >= revealAt;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(!live)}
      aria-label={live ? ar.challenge.reactionNow : ar.challenge.reactionWait}
      className={`flex h-72 w-full items-center justify-center rounded-chunk transition-colors duration-75 ${
        live ? 'bg-good' : 'bg-ink-800'
      }`}
    >
      {live ? (
        <motion.span
          initial={{ scale: 0.3 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 700, damping: 14 }}
          className="font-display text-5xl font-black text-ink-950"
        >
          {ar.challenge.reactionNow}
        </motion.span>
      ) : (
        <span className="font-display text-3xl text-cream/40">{ar.challenge.reactionWait}</span>
      )}
    </button>
  );
}
