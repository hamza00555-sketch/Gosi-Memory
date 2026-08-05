import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArStage } from '../../ar';
import type { ArStatus } from '../../ar';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { ScreenFallback } from '../../components/ScreenFallback';
import { isScanPhase } from '../../domain/game';
import { useCommands, useHostAuthority, useRoom } from '../../game/state/useRoom';
import { useServerClock } from '../../game/state/useServerClock';
import { useDeviceStore } from '../../state/deviceStore';
import { useSound } from '../../audio/useSound';
import { ar } from '../../i18n/ar';
import { to } from '../../app/routes';
import { GameHud } from './GameHud';
import { ScanSlots } from './ScanSlots';
import { TurnPrompt } from './TurnPrompt';
import { useScanPipeline } from './useScanPipeline';
import { useMatchSounds } from './useMatchSounds';
import { CountdownOverlay } from './overlays/CountdownOverlay';
import { OutcomeOverlay } from './overlays/OutcomeOverlay';
import { RoundResetOverlay } from './overlays/RoundResetOverlay';

const ChallengeOverlay = lazy(() => import('../challenge/ChallengeOverlay'));
const PuzzleOverlay = lazy(() => import('../puzzle/PuzzleOverlay'));

/**
 * The match screen.
 *
 * There is no digital card grid — the camera IS the board. Everything here is
 * chrome over a live video feed: what was recognized, whose turn it is, and how
 * long is left. Nothing on this screen decides an outcome; it renders canonical
 * state and forwards intent.
 */
export default function CameraGameScreen(): JSX.Element {
  const { roomId = null } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const objectSetId = useDeviceStore((s) => s.selectedObjectSetId);

  const [arStatus, setArStatus] = useState<ArStatus>('idle');
  const { room, connection, hostAbsent, myTeamId, isHost, loading } = useRoom(roomId);
  useHostAuthority(roomId, isHost);

  const sender = useCommands(roomId, myTeamId);
  const pipeline = useScanPipeline(room, myTeamId, sender);
  const now = useServerClock(200);
  const { play } = useSound();
  useMatchSounds(room);

  const phase = room?.game.phase;
  const myTurn = !!room && !!myTeamId && room.game.activeTeamId === myTeamId;

  // A match is a fixed, full-bleed canvas: no scrolling or rubber-banding while
  // players are waving the phone over a table.
  useEffect(() => {
    document.body.dataset.lockViewport = 'true';
    return () => {
      delete document.body.dataset.lockViewport;
    };
  }, []);

  useEffect(() => {
    if (phase === 'completed' && roomId) {
      const t = window.setTimeout(() => navigate(to.results(roomId)), 1200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, roomId, navigate]);

  const remainingMs = useMemo(() => {
    if (!room || !isScanPhase(room.game.phase)) return 0;
    return Math.max(0, room.game.turnEndsAt - now);
  }, [room, now]);

  if (loading || !room) return <ScreenFallback />;

  const scanning = isScanPhase(room.game.phase);
  const awaiting = room.game.phase === 'scanning_first' ? 'first' : scanning ? 'second' : null;
  const puzzle = myTeamId ? room.puzzles[myTeamId] : null;
  const puzzleOpen = room.game.phase === 'puzzle';
  const canOpenPuzzle =
    myTurn && scanning && !!puzzle && !puzzle.solved && !puzzle.lockedUntilNextTurn;

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      <ArStage
        objectSetId={objectSetId}
        onSighting={pipeline.onSighting}
        onStatusChange={setArStatus}
      >
        <div
          className="pointer-events-none flex h-full flex-col justify-between"
          style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
        >
          <div className="pointer-events-auto flex flex-col gap-2">
            <ConnectionBanner status={connection} hostAbsent={hostAbsent} />
            <GameHud room={room} myTeamId={myTeamId} remainingMs={remainingMs} />
            {scanning && <ScanSlots first={room.game.firstTargetId} second={room.game.secondTargetId} awaiting={awaiting} />}
          </div>

          <div className="pointer-events-auto flex flex-col gap-3 px-3 pb-3">
            <TurnPrompt
              room={room}
              myTurn={myTurn}
              feedback={pipeline.feedback}
              visibleCount={pipeline.visible.length}
              arStatus={arStatus}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost flex-1 py-3 text-base"
                onClick={() => play('scan_ok')}
                aria-label={ar.game.help}
              >
                {ar.game.help}
              </button>
              <button
                type="button"
                disabled={!canOpenPuzzle}
                onClick={() => void sender.send({ type: 'OPEN_PUZZLE' })}
                className="btn-primary flex-[2] py-3 text-base"
              >
                {puzzle?.lockedUntilNextTurn ? ar.game.puzzleLocked : ar.game.puzzleButton}
              </button>
            </div>
          </div>
        </div>
      </ArStage>

      <AnimatePresence>
        {room.game.phase === 'countdown' && room.game.countdownEndsAt !== null && (
          <CountdownOverlay key="countdown" endsAt={room.game.countdownEndsAt} />
        )}

        {room.game.phase === 'resolving' && room.game.lastOutcome && (
          <OutcomeOverlay key="outcome" outcome={room.game.lastOutcome} myTeamId={myTeamId} />
        )}

        {room.game.phase === 'round_reset' && (
          <RoundResetOverlay
            key="round"
            room={room}
            myTeamId={myTeamId}
            onConfirm={() => void sender.send({ type: 'ROUND_READY' })}
          />
        )}

        {room.game.phase === 'challenge' && room.challenge && (
          <Suspense key="challenge" fallback={null}>
            <ChallengeOverlay
              room={room}
              challenge={room.challenge}
              myTeamId={myTeamId}
              onSubmit={({ answer, sequence }) =>
                void sender.send({ type: 'SUBMIT_CHALLENGE', answer, sequence })
              }
            />
          </Suspense>
        )}

        {puzzleOpen && puzzle && (
          <Suspense key="puzzle" fallback={null}>
            <PuzzleOverlay
              puzzle={puzzle}
              canAnswer={room.game.puzzleTeamId === myTeamId}
              onAnswer={(answer) => void sender.send({ type: 'ATTEMPT_PUZZLE', answer })}
              onClose={() => void sender.send({ type: 'TURN_TIMEOUT' })}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
