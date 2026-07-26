import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBackend } from '../../backend';
import type { ConnectionStatus, PresenceState } from '../../backend/types';
import type { Command, CommandIntent, CommandType, Rejection } from '../../domain/commands';
import type { RoomState } from '../../domain/game';
import type { RoomId, TeamId } from '../../domain/ids';
import { useDeviceStore } from '../../state/deviceStore';

export interface RoomView {
  room: RoomState | null;
  presence: PresenceState;
  connection: ConnectionStatus;
  loading: boolean;
  /** True while the host device is unreachable — the match is paused. */
  hostAbsent: boolean;
  myTeamId: TeamId | null;
  isHost: boolean;
}

const EMPTY_PRESENCE: PresenceState = { online: {}, hostPresent: true };

/**
 * Subscribe to canonical room state.
 *
 * The room is never held in a global store: it is owned by the backend and
 * mirrored into component state here. That is what makes a refresh
 * survivable — there is no local copy that could drift from the server.
 */
export function useRoom(roomId: RoomId | null): RoomView {
  const backend = getBackend();
  const deviceUid = useDeviceStore((s) => s.deviceUid);

  const [room, setRoom] = useState<RoomState | null>(null);
  const [presence, setPresence] = useState<PresenceState>(EMPTY_PRESENCE);
  const [connection, setConnection] = useState<ConnectionStatus>('connecting');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubRoom = backend.subscribeToRoom(roomId, (next) => {
      setRoom(next);
      setLoading(false);
    });
    const unsubPresence = backend.subscribeToPresence(roomId, setPresence);
    return () => {
      unsubRoom();
      unsubPresence();
    };
  }, [backend, roomId]);

  useEffect(() => backend.subscribeToConnection(setConnection), [backend]);

  const myTeamId = useMemo<TeamId | null>(() => {
    if (!room || !deviceUid) return null;
    if (room.teams.teamA.deviceUid === deviceUid) return 'teamA';
    if (room.teams.teamB.deviceUid === deviceUid) return 'teamB';
    return null;
  }, [room, deviceUid]);

  const isHost = !!room && !!deviceUid && room.hostUid === deviceUid;

  return {
    room,
    presence,
    connection,
    loading,
    // The host owns the write path; without it nothing can advance, so we pause
    // rather than let a second device start writing conflicting state.
    hostAbsent: !!room && !presence.hostPresent && !isHost,
    myTeamId,
    isHost,
  };
}

/**
 * The host device runs the rules engine. Mounting this starts the command
 * consumer and the deadline watchdog; it is a no-op on a guest device.
 */
export function useHostAuthority(roomId: RoomId | null, isHost: boolean): void {
  const backend = getBackend();
  useEffect(() => {
    if (!roomId || !isHost) return;
    return backend.startHostAuthority(roomId, useDeviceStore.getState().deviceUid ?? '');
  }, [backend, roomId, isHost]);
}

export interface CommandSender {
  send: (input: CommandIntent) => Promise<void>;
  /** Last refusal from the engine, for surfacing Arabic copy. */
  lastRejection: Rejection | null;
  clearRejection: () => void;
  pending: boolean;
}

let commandCounter = 0;

/**
 * Send intents to the authoritative writer.
 *
 * A command carries what the player tried to do — never what should happen as
 * a result. Identity is stamped from the device's own auth uid and team, so a
 * tampered payload cannot act on behalf of the other side.
 */
export function useCommands(roomId: RoomId | null, myTeamId: TeamId | null): CommandSender {
  const backend = getBackend();
  const deviceUid = useDeviceStore((s) => s.deviceUid);
  const [lastRejection, setLastRejection] = useState<Rejection | null>(null);
  const [pending, setPending] = useState(false);
  const inflight = useRef(0);

  const send = useCallback<CommandSender['send']>(
    async (input) => {
      const teamId = input.teamId ?? myTeamId;
      if (!roomId || !teamId || !deviceUid) return;

      commandCounter += 1;
      const command = {
        ...input,
        teamId,
        deviceUid,
        id: `${deviceUid}_${backend.now()}_${commandCounter}`,
        createdAt: backend.now(),
      } as Command;

      inflight.current += 1;
      setPending(true);
      try {
        await backend.sendCommand(roomId, command);
      } finally {
        inflight.current -= 1;
        if (inflight.current === 0) setPending(false);
      }
    },
    [backend, roomId, myTeamId, deviceUid],
  );

  const clearRejection = useCallback(() => setLastRejection(null), []);

  return { send, lastRejection, clearRejection, pending };
}

/** Narrow helper so screens can fire a bare command type without ceremony. */
export function useSimpleCommand(
  sender: CommandSender,
): (type: Extract<CommandType, 'ACK_RESOLVE' | 'OPEN_PUZZLE' | 'ROUND_READY' | 'TURN_TIMEOUT'>) => void {
  return useCallback(
    (type) => {
      void sender.send({ type } as never);
    },
    [sender],
  );
}
