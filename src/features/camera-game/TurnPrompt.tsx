import { AnimatePresence, motion } from 'framer-motion';
import type { ArStatus } from '../../ar';
import type { RoomState } from '../../domain/game';
import { ar } from '../../i18n/ar';
import type { ScanFeedback } from './useScanPipeline';

interface Props {
  room: RoomState;
  myTurn: boolean;
  feedback: ScanFeedback;
  /** How many cards the camera can currently see. */
  visibleCount: number;
  arStatus: ArStatus;
}

/**
 * One line of guidance, chosen by precedence: a live rejection reason beats the
 * generic instruction, because "اختر بطاقة مختلفة" is far more useful than
 * repeating "اقلب البطاقة الثانية" while the player waves the wrong card.
 */
export function TurnPrompt({ room, myTurn, feedback, visibleCount, arStatus }: Props): JSX.Element {
  const { text, tone } = resolvePrompt(room, myTurn, feedback, visibleCount, arStatus);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={text}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -10, opacity: 0 }}
        transition={{ duration: 0.16 }}
        role="status"
        aria-live="polite"
        className={`hud-chip w-full text-center text-base ${
          tone === 'warn' ? 'text-pop-yellow' : tone === 'bad' ? 'text-bad' : 'text-cream'
        }`}
      >
        {text}
      </motion.p>
    </AnimatePresence>
  );
}

function resolvePrompt(
  room: RoomState,
  myTurn: boolean,
  feedback: ScanFeedback,
  visibleCount: number,
  arStatus: ArStatus,
): { text: string; tone: 'neutral' | 'warn' | 'bad' } {
  // A broken recognizer used to be indistinguishable from "no card in frame",
  // which sent players hunting for a better angle at a camera that was never
  // going to match anything. Say so instead.
  if (arStatus === 'no_targets') return { text: ar.game.recognitionFailed, tone: 'bad' };
  if (arStatus === 'denied') return { text: ar.camera.denied, tone: 'bad' };
  if (arStatus === 'requesting' || arStatus === 'idle') {
    return { text: ar.game.startingCamera, tone: 'neutral' };
  }
  if (arStatus === 'granted') return { text: ar.game.loadingTargets, tone: 'neutral' };

  if (!myTurn) return { text: ar.game.watching, tone: 'neutral' };

  if (feedback.kind === 'unsteady') return { text: ar.game.holdSteady, tone: 'warn' };
  if (feedback.kind === 'not_selectable') {
    const alreadyPicked = room.game.firstTargetId === feedback.targetId;
    return {
      text: alreadyPicked ? ar.game.pickDifferent : ar.game.alreadyCollected,
      tone: 'bad',
    };
  }
  if (feedback.kind === 'accepted') return { text: ar.game.recognized, tone: 'neutral' };

  if (visibleCount === 0) return { text: ar.game.aimCamera, tone: 'neutral' };

  return {
    text: room.game.phase === 'scanning_first' ? ar.game.firstCard : ar.game.secondCard,
    tone: 'neutral',
  };
}
