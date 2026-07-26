import type { Command } from '../domain/commands';
import type { RoomState } from '../domain/game';
import type { DeviceUid, RoomCode, RoomId, TeamId } from '../domain/ids';
import type { Team } from '../domain/teams';

/**
 * The IO seam. Screens and hooks depend on this interface only — never on
 * Firebase directly — so the realtime backend and the offline dev backend are
 * interchangeable and neither leaks into a component.
 */

export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'host_absent';

export interface PresenceState {
  /** Devices currently connected, by uid. */
  online: Record<DeviceUid, boolean>;
  hostPresent: boolean;
}

export type TeamSetupPatch = Partial<
  Pick<Team, 'name' | 'color' | 'playerCount' | 'players' | 'objectSetId' | 'ready'>
>;

export interface CreateRoomInput {
  hostUid: DeviceUid;
  targetScore: number;
}

export interface BackendError extends Error {
  code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'NOT_CONFIGURED' | 'AUTH_FAILED' | 'NETWORK' | 'UNKNOWN';
}

export interface RoomBackend {
  /** 'firebase' | 'local' — surfaced in the UI so a dev build is never mistaken for the real thing. */
  readonly kind: 'firebase' | 'local';

  /** Sign in anonymously (or restore) and return this device's stable uid. */
  ensureIdentity(): Promise<DeviceUid>;

  createRoom(input: CreateRoomInput): Promise<RoomState>;
  joinRoomByCode(code: RoomCode, uid: DeviceUid): Promise<RoomState>;
  leaveRoom(roomId: RoomId, uid: DeviceUid): Promise<void>;

  /** Live canonical room state. Fires immediately with the current value. */
  subscribeToRoom(roomId: RoomId, cb: (room: RoomState | null) => void): () => void;
  subscribeToPresence(roomId: RoomId, cb: (presence: PresenceState) => void): () => void;
  subscribeToConnection(cb: (status: ConnectionStatus) => void): () => void;

  /** Append an intent. Never writes game state directly. */
  sendCommand(roomId: RoomId, command: Command): Promise<void>;

  /** Lobby-only edits to a team's own setup. Rejected once the match starts. */
  updateTeamSetup(roomId: RoomId, teamId: TeamId, patch: TeamSetupPatch): Promise<void>;

  /** Host writes the target score before kickoff. */
  updateTargetScore(roomId: RoomId, targetScore: number): Promise<void>;

  /** Host leaves the lobby and starts the match countdown. */
  startMatch(roomId: RoomId): Promise<void>;

  /**
   * Begin consuming the command queue on the host device. Returns a stop
   * function. Non-host devices never call this.
   */
  startHostAuthority(roomId: RoomId, hostUid: DeviceUid): () => void;

  /**
   * Server clock, skew-corrected. Every deadline in the game is compared
   * against this rather than Date.now(), so two devices with different clocks
   * still agree on when a turn or a challenge ended.
   */
  now(): number;
}
