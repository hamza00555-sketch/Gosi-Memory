import { motion } from 'framer-motion';
import { getCard } from '../../content';
import type { TargetId } from '../../domain/ids';
import { ar } from '../../i18n/ar';

interface Props {
  first: TargetId | null;
  second: TargetId | null;
  /** Highlights the slot the player is being asked to fill. */
  awaiting: 'first' | 'second' | null;
}

/**
 * The two card slots. This is the only place a card is represented on screen —
 * as a name confirming what was recognized, never as a playable tile.
 */
export function ScanSlots({ first, second, awaiting }: Props): JSX.Element {
  return (
    <div className="flex items-stretch gap-2 px-3">
      <Slot label={ar.game.slotFirst} targetId={first} active={awaiting === 'first'} />
      <Slot label={ar.game.slotSecond} targetId={second} active={awaiting === 'second'} />
    </div>
  );
}

function Slot({
  label,
  targetId,
  active,
}: {
  label: string;
  targetId: TargetId | null;
  active: boolean;
}): JSX.Element {
  const card = targetId ? getCard(targetId) : undefined;

  return (
    <div
      className={`flex-1 rounded-chunk px-3 py-2 backdrop-blur-md transition-colors ${
        card
          ? 'bg-good/25 ring-1 ring-good/60'
          : active
            ? 'animate-pulse-ring bg-ink-950/70 text-pop-yellow ring-1 ring-pop-yellow/70'
            : 'bg-ink-950/55'
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-cream/45">{label}</p>
      {card ? (
        <motion.p
          key={card.targetId}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 18 }}
          className="truncate font-display text-base font-bold text-cream"
        >
          {card.name}
        </motion.p>
      ) : (
        <p className="font-display text-base text-cream/30">{ar.game.empty}</p>
      )}
    </div>
  );
}
