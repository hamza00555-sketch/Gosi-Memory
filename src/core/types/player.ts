import type { CosmeticId, PlayerId } from './ids';

export interface Player {
  id: PlayerId;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  coins: number;
  xp: number;
  selectedCardSkin: CosmeticId;
  selectedArSet: CosmeticId;
}

/** A player as they appear inside a room (presence + readiness). */
export interface RoomMember {
  playerId: PlayerId;
  displayName: string;
  avatarUrl: string | null;
  isReady: boolean;
  isConnected: boolean;
  /** Team assignment for 2v2; null in solo / 1v1. */
  teamId: string | null;
  /** Used to detect stale presence after a disconnect. */
  lastSeenAt: number;
}
