import { AnimatePresence, motion } from 'framer-motion';
import { useCountdown } from '../../../game/state/useServerClock';
import { ar } from '../../../i18n/ar';

interface Props {
  /** Server time the countdown ends. Both devices read the same value. */
  endsAt: number;
}

/** The synchronized "3, 2, 1, go" both teams see at the same instant. */
export function CountdownOverlay({ endsAt }: Props): JSX.Element {
  const seconds = useCountdown(endsAt, 60);
  const label = seconds > 0 ? String(seconds) : ar.countdown.go;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink-950/85 backdrop-blur-sm"
    >
      <p className="font-display text-2xl text-cream/70">{ar.countdown.getReady}</p>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={label}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 480, damping: 16 }}
          className="nums font-display text-8xl font-black text-pop-yellow"
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}
