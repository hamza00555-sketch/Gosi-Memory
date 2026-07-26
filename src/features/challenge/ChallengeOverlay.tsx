import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChallengeState } from '../../domain/challenge';
import type { TeamId } from '../../domain/ids';
import type { RoomState } from '../../domain/game';
import { useServerClock } from '../../game/state/useServerClock';
import { ar } from '../../i18n/ar';
import { ReactionRush } from './games/ReactionRush';
import { SequenceMemory } from './games/SequenceMemory';
import { VisualPuzzleGame } from './games/VisualPuzzleGame';
import { TeamSync } from './games/TeamSync';

export interface ChallengeSubmitPayload {
  answer: number;
  sequence: number[];
}

interface Props {
  room: RoomState;
  challenge: ChallengeState;
  myTeamId: TeamId | null;
  onSubmit: (payload: ChallengeSubmitPayload) => void;
}

/**
 * The mini-game layer.
 *
 * Both devices mount this at the same instant and read every deadline from the
 * broadcast challenge, so the race is fair even though each screen runs its own
 * render loop. A device only ever reports what its players did — the host
 * decides who was right.
 */
export default function ChallengeOverlay({
  room,
  challenge,
  myTeamId,
  onSubmit,
}: Props): JSX.Element {
  const now = useServerClock(60);
  const [submitted, setSubmitted] = useState(false);

  const mySubmission = myTeamId ? challenge.submissions[myTeamId] : undefined;
  const canRetry =
    !!mySubmission &&
    !mySubmission.correct &&
    mySubmission.attempts < 2 &&
    challenge.advantage === 'extra_attempt' &&
    myTeamId === challenge.advantagedTeamId;

  // A fresh challenge must clear the previous one's submitted latch.
  useEffect(() => {
    setSubmitted(false);
  }, [challenge.challengeId, challenge.startsAt]);

  const interactiveAt =
    challenge.advantage === 'head_start' && myTeamId !== challenge.advantagedTeamId
      ? challenge.startsAt + challenge.headStartMs
      : challenge.startsAt;

  const live = now >= interactiveAt && now <= challenge.endsAt;
  const locked = submitted && !canRetry;
  const remainingMs = Math.max(0, challenge.endsAt - now);
  const remainingSec = Math.ceil(remainingMs / 1000);

  const handleSubmit = (payload: ChallengeSubmitPayload): void => {
    if (locked) return;
    setSubmitted(true);
    onSubmit(payload);
  };

  const hasAdvantage = myTeamId === challenge.advantagedTeamId;
  const playerCount = myTeamId ? room.teams[myTeamId].playerCount : 1;

  const body = useMemo(() => {
    if (!live) return null;
    switch (challenge.payload.kind) {
      case 'reaction_rush':
        return (
          <ReactionRush
            revealAt={challenge.payload.revealAt}
            now={now}
            disabled={locked}
            onPress={(early) => handleSubmit({ answer: early ? -1 : 1, sequence: [] })}
          />
        );
      case 'sequence_memory':
        return (
          <SequenceMemory
            sequence={challenge.payload.sequence}
            palette={challenge.payload.palette}
            showUntil={interactiveAt + challenge.payload.hideAtMs}
            now={now}
            disabled={locked}
            onSubmit={(indices) => handleSubmit({ answer: 0, sequence: indices })}
          />
        );
      case 'visual_puzzle':
        return (
          <VisualPuzzleGame
            options={challenge.payload.options}
            image={challenge.payload.image}
            disabled={locked}
            onPick={(index) => handleSubmit({ answer: index, sequence: [] })}
          />
        );
      case 'team_sync':
        return (
          <TeamSync
            zones={Math.min(3, Math.max(1, playerCount))}
            disabled={locked}
            onComplete={(held) => handleSubmit({ answer: held, sequence: [] })}
          />
        );
      default:
        return null;
    }
    // handleSubmit is stable enough for this overlay's lifetime; re-creating the
    // body on every clock tick would restart the mini-games.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.payload, live, locked, now, interactiveAt, playerCount]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex flex-col bg-ink-950/95 backdrop-blur-sm"
      style={{
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      <header className="flex items-center justify-between px-5 pt-4">
        <motion.h2
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
          className="text-2xl text-pop-yellow"
        >
          {ar.challenge.title}
        </motion.h2>
        <div
          className={`hud-chip nums text-lg ${remainingSec <= 3 ? 'text-bad' : 'text-cream'}`}
          aria-live="off"
        >
          {remainingSec}
        </div>
      </header>

      <p className="px-5 pt-3 text-balance text-lg text-cream/80">{challenge.prompt}</p>

      {hasAdvantage && (
        <p className="px-5 pt-1 text-sm font-bold text-good">{ar.challenge.advantage}</p>
      )}

      <div className="flex flex-1 items-center justify-center px-5 py-4">
        <AnimatePresence mode="wait">
          {!live && now < interactiveAt && (
            <motion.p
              key="waiting"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-3xl text-cream/70"
            >
              {ar.challenge.getReady}
            </motion.p>
          )}
          {live && !locked && (
            <motion.div key="game" className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {body}
            </motion.div>
          )}
          {locked && (
            <motion.p
              key="submitted"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl text-cream/70"
            >
              {ar.challenge.waiting}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
