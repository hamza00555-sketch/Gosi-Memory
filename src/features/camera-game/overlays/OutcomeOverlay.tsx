import { motion } from 'framer-motion';
import { getCard } from '../../../content';
import type { TurnOutcome } from '../../../domain/game';
import type { TeamId } from '../../../domain/ids';
import { ar } from '../../../i18n/ar';

interface Props {
  outcome: TurnOutcome;
  myTeamId: TeamId | null;
}

/** The short beat between the second scan and whatever happens next. */
export function OutcomeOverlay({ outcome, myTeamId }: Props): JSX.Element {
  const matched = outcome.kind === 'match';
  const mine = outcome.teamId === myTeamId;
  const first = getCard(outcome.firstTargetId);
  const second = getCard(outcome.secondTargetId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-ink-950/85 px-8 backdrop-blur-sm"
      role="status"
      aria-live="assertive"
    >
      <motion.h2
        initial={{ scale: 0.5, rotate: matched ? -8 : 0 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 460, damping: 14 }}
        className={`text-center text-5xl ${matched ? 'text-good' : 'text-bad'}`}
      >
        {matched ? ar.outcome.matchTitle : ar.outcome.mismatchTitle}
      </motion.h2>

      <div className="flex items-center gap-3">
        {[first, second].map((card, i) => (
          <motion.div
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08 * i }}
            className={`rounded-chunk px-4 py-3 font-display text-lg ${
              matched ? 'bg-good/20 text-good' : 'bg-bad/15 text-cream'
            }`}
          >
            {card?.name ?? ar.game.empty}
          </motion.div>
        ))}
      </div>

      <p className="text-balance text-center text-lg text-cream/75">
        {matched ? ar.outcome.matchBody : ar.outcome.mismatchBody}
      </p>

      <p className="text-sm font-bold text-cream/50">
        {matched
          ? mine
            ? ar.outcome.turnKept
            : ''
          : ar.outcome.turnPassed}
      </p>
    </motion.div>
  );
}
