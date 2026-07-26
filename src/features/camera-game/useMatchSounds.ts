import { useEffect, useRef } from 'react';
import type { RoomState } from '../../domain/game';
import { useSound } from '../../audio/useSound';

/**
 * Plays match audio from *state transitions* rather than from engine events.
 *
 * Events fire only on the device that ran the reducer; both devices see the
 * state change. Diffing the canonical state is therefore what keeps the two
 * screens in audible sync — and it survives a reconnect, which a missed event
 * would not.
 */
export function useMatchSounds(room: RoomState | null): void {
  const { play } = useSound();
  const prev = useRef<{
    version: number;
    phase: string;
    matched: number;
    scores: { teamA: number; teamB: number };
  } | null>(null);

  useEffect(() => {
    if (!room) return;

    const snapshot = {
      version: room.game.version,
      phase: room.game.phase,
      matched: Object.keys(room.game.matchedPairIds).length,
      scores: { teamA: room.game.scores.teamA ?? 0, teamB: room.game.scores.teamB ?? 0 },
    };
    const before = prev.current;
    prev.current = snapshot;
    if (!before) return;

    if (snapshot.phase !== before.phase) {
      switch (snapshot.phase) {
        case 'resolving':
          play(room.game.lastOutcome?.kind === 'match' ? 'match' : 'mismatch');
          break;
        case 'challenge':
          play('challenge_start');
          break;
        case 'completed':
          play('victory');
          break;
        default:
          break;
      }
    }

    if (snapshot.matched > before.matched) play('puzzle_piece');

    const gained =
      snapshot.scores.teamA > before.scores.teamA || snapshot.scores.teamB > before.scores.teamB;
    if (gained && snapshot.phase === 'scanning_first') play('challenge_win');
  }, [room, play]);
}
