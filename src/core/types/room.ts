import type { EpochMs, PlayerId, RoomCode, RoomId, TeamId } from './ids';
import type { RoomMember } from './player';

export type GameMode = 'solo_ai' | 'one_vs_one' | 'two_vs_two';

export type RoomStatus = 'waiting' | 'ready' | 'in_progress' | 'completed';

export interface Team {
  id: TeamId;
  name: string;
  memberIds: PlayerId[];
}

export interface Room {
  id: RoomId;
  code: RoomCode;
  mode: GameMode;
  status: RoomStatus;
  hostId: PlayerId;
  members: RoomMember[];
  teams: Team[];
  /** Set once startGame() succeeds; links the room to its live game. */
  gameId: string | null;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}
