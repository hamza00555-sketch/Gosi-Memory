import { useEffect, useState } from 'react';
import { getGameService } from '../services';
import type { Game } from '../core/types/game';
import type { Room } from '../core/types/room';

/**
 * Subscribes to a room and (once it exists) its game, returning the latest
 * authoritative snapshots. This is the ONLY place screens get live state from,
 * keeping Supabase/subscription wiring out of components.
 */
export function useRoomGame(roomId: string | undefined): {
  room: Room | null;
  game: Game | null;
} {
  const [room, setRoom] = useState<Room | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const service = getGameService();
    const unsubRoom = service.subscribeToRoom(roomId, setRoom);
    return () => unsubRoom();
  }, [roomId]);

  const gameId = room?.gameId ?? null;
  useEffect(() => {
    if (!gameId) {
      setGame(null);
      return;
    }
    const service = getGameService();
    const unsubGame = service.subscribeToGame(gameId, setGame);
    return () => unsubGame();
  }, [gameId]);

  return { room, game };
}
