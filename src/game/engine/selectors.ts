import { CARDS, TOTAL_PAIRS, getCard } from '../../content';
import type { CardRuntimeState } from '../../domain/cards';
import type { RoomState } from '../../domain/game';
import { isScanPhase } from '../../domain/game';
import type { DeviceUid, EpochMs, TargetId, TeamId } from '../../domain/ids';
import { activePlayerLabel } from '../../domain/teams';

/**
 * Read-only views over canonical state. Components consult these instead of
 * poking at the state shape, so a schema change lands in one place.
 */

export function teamOfDevice(room: RoomState, uid: DeviceUid): TeamId | null {
  if (room.teams.teamA.deviceUid === uid) return 'teamA';
  if (room.teams.teamB.deviceUid === uid) return 'teamB';
  return null;
}

export function isMyTurn(room: RoomState, teamId: TeamId | null): boolean {
  return teamId !== null && room.game.activeTeamId === teamId;
}

/** Milliseconds left on the turn clock, floored at zero. */
export function remainingTurnMs(room: RoomState, now: EpochMs): number {
  return Math.max(0, room.game.turnEndsAt - now);
}

export function remainingChallengeMs(room: RoomState, now: EpochMs): number {
  if (!room.challenge) return 0;
  return Math.max(0, room.challenge.endsAt - now);
}

export function activePlayerName(room: RoomState): string {
  return activePlayerLabel(room.teams[room.game.activeTeamId]);
}

/**
 * Per-card view used by the AR layer to decide whether a recognized card may be
 * offered as a selection. Note `locked` is about the *rules*, not visibility —
 * a locked card still renders its object.
 */
export function cardRuntimeStates(
  room: RoomState,
  viewerTeamId: TeamId | null,
): Record<TargetId, CardRuntimeState> {
  const myTurn = isMyTurn(room, viewerTeamId);
  const scanning = isScanPhase(room.game.phase);
  const out: Record<TargetId, CardRuntimeState> = {};

  for (const card of CARDS) {
    const matched = room.game.matchedPairIds[card.pairId] === true;
    out[card.targetId] = {
      targetId: card.targetId,
      pairId: card.pairId,
      matched,
      locked:
        matched ||
        !myTurn ||
        !scanning ||
        room.game.firstTargetId === card.targetId,
    };
  }
  return out;
}

/** Whether this specific card could be registered as a selection right now. */
export function canSelectCard(
  room: RoomState,
  viewerTeamId: TeamId | null,
  targetId: TargetId,
): boolean {
  const card = getCard(targetId);
  if (!card) return false;
  if (!isScanPhase(room.game.phase)) return false;
  if (!isMyTurn(room, viewerTeamId)) return false;
  if (room.game.matchedPairIds[card.pairId] === true) return false;
  if (room.game.phase === 'scanning_second' && room.game.firstTargetId === targetId) return false;
  return true;
}

export function matchedPairsRemaining(room: RoomState): number {
  return TOTAL_PAIRS - Object.keys(room.game.matchedPairIds).length;
}

export function bothTeamsPresent(room: RoomState): boolean {
  return room.teams.teamA.deviceUid !== null && room.teams.teamB.deviceUid !== null;
}

export function bothTeamsReady(room: RoomState): boolean {
  return bothTeamsPresent(room) && room.teams.teamA.ready && room.teams.teamB.ready;
}

export function scoreOf(room: RoomState, teamId: TeamId): number {
  return room.game.scores[teamId] ?? 0;
}

/** Progress toward the target score, 0..1 — drives the score bars. */
export function scoreProgress(room: RoomState, teamId: TeamId): number {
  const target = room.game.targetScore || 1;
  return Math.min(1, scoreOf(room, teamId) / target);
}
