import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScanGate } from '../../ar/recognition/scanGate';
import type { TargetSighting } from '../../ar/recognition/types';
import type { RoomState } from '../../domain/game';
import type { TargetId, TeamId } from '../../domain/ids';
import { canSelectCard } from '../../game/engine/selectors';
import type { CommandSender } from '../../game/state/useRoom';

export type ScanFeedback =
  | { kind: 'idle' }
  | { kind: 'accepted'; targetId: TargetId }
  | { kind: 'unsteady' }
  | { kind: 'not_selectable'; targetId: TargetId };

export interface ScanPipeline {
  /** Feed every sighting from the AR layer; the gate decides what counts. */
  onSighting: (sighting: TargetSighting) => void;
  /** Target ids currently visible to the camera, for HUD affordances. */
  visible: TargetId[];
  feedback: ScanFeedback;
}

/**
 * Turns a noisy stream of AR sightings into at most one deliberate selection.
 *
 * Recognition and selection are deliberately different things: a card left
 * lying face-up keeps its object on screen the whole time, but must register
 * exactly once. The ScanGate enforces confidence, multi-frame stability, a
 * per-card debounce and a global cooldown; the rules decide selectability. Only
 * a scan that survives all of it becomes a command — and the host re-validates
 * even then.
 */
export function useScanPipeline(
  room: RoomState | null,
  myTeamId: TeamId | null,
  sender: CommandSender,
): ScanPipeline {
  const [visible, setVisible] = useState<TargetId[]>([]);
  const [feedback, setFeedback] = useState<ScanFeedback>({ kind: 'idle' });

  // The gate is long-lived; the rules it consults change every frame, so they
  // are read through a ref rather than rebuilding the gate and losing its
  // stability counters.
  const rulesRef = useRef<{ room: RoomState | null; teamId: TeamId | null }>({
    room,
    teamId: myTeamId,
  });
  rulesRef.current = { room, teamId: myTeamId };

  const gate = useMemo(
    () =>
      new ScanGate({
        isSelectable: (targetId: string) => {
          const current = rulesRef.current;
          if (!current.room) return false;
          return canSelectCard(current.room, current.teamId, targetId);
        },
      }),
    [],
  );

  // A new turn must not inherit the previous turn's debounce, or the first card
  // of the new turn could be silently swallowed.
  const turnKey = room ? `${room.game.activeTeamId}:${room.game.turnStartedAt}` : 'none';
  useEffect(() => {
    gate.reset();
    setFeedback({ kind: 'idle' });
  }, [gate, turnKey]);

  const onSighting = useCallback(
    (sighting: TargetSighting) => {
      setVisible((prev) =>
        prev.includes(sighting.targetId) ? prev : [...prev, sighting.targetId],
      );

      const verdict = gate.feed(sighting);
      if (verdict === 'accepted') {
        setFeedback({ kind: 'accepted', targetId: sighting.targetId });
        void sender.send({
          type: 'SCAN_TARGET',
          targetId: sighting.targetId,
          confidence: sighting.confidence,
        });
        return;
      }
      if (verdict === 'rejected_confidence' || verdict === 'rejected_unstable') {
        setFeedback({ kind: 'unsteady' });
        return;
      }
      if (verdict === 'rejected_not_selectable') {
        setFeedback({ kind: 'not_selectable', targetId: sighting.targetId });
      }
    },
    [gate, sender],
  );

  return { onSighting, visible, feedback };
}

/** Track which targets are currently in frame, honouring the lost-grace period. */
export function useVisibleTargets(): {
  visible: TargetId[];
  markFound: (id: TargetId) => void;
  markLost: (id: TargetId) => void;
} {
  const [visible, setVisible] = useState<TargetId[]>([]);
  const markFound = useCallback((id: TargetId) => {
    setVisible((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);
  const markLost = useCallback((id: TargetId) => {
    setVisible((prev) => prev.filter((t) => t !== id));
  }, []);
  return { visible, markFound, markLost };
}
