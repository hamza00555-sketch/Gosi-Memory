import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { useRoomGame } from '../../hooks/useRoomGame';
import { useSessionStore } from '../../state/sessionStore';
import { useToastStore } from '../../state/toastStore';
import { getGameService } from '../../services';
import { AI_PLAYER_ID } from '../../services/local/LocalGameService';

export default function RoomScreen(): JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const player = useSessionStore((s) => s.player);
  const pushToast = useToastStore((s) => s.push);
  const { room } = useRoomGame(roomId);
  const [joined, setJoined] = useState(false);

  const service = getGameService();
  const me = useMemo(
    () => room?.members.find((m) => m.playerId === player.id),
    [room, player.id],
  );

  // Ensure presence / auto-join when arriving via an invite link.
  useEffect(() => {
    if (!roomId) return;
    void service.reconnectToRoom({ roomId, playerId: player.id });
  }, [roomId, player.id, service]);

  useEffect(() => {
    if (!room || joined || me) return;
    setJoined(true);
    void service
      .joinRoom({
        code: room.code,
        player: {
          playerId: player.id,
          displayName: player.displayName,
          avatarUrl: player.avatarUrl,
        },
      })
      .then((r) => {
        if (!r.ok) pushToast(r.error.message, 'error');
      });
  }, [room, me, joined, service, player, pushToast]);

  // When the host starts, everyone is pushed into the game.
  useEffect(() => {
    if (room?.status === 'in_progress' && room.gameId) navigate(`/game/${room.id}`);
  }, [room?.status, room?.gameId, room?.id, navigate]);

  if (!room) {
    return (
      <div className="flex h-full items-center justify-center text-white/60">
        {ar.common.loading}
      </div>
    );
  }

  const isHost = room.hostId === player.id;
  const inviteUrl = `${window.location.origin}/room/${room.id}`;
  const humans = room.members.filter((m) => m.playerId !== AI_PLAYER_ID);

  const toggleReady = () =>
    service.setReady({ roomId: room.id, playerId: player.id, isReady: !me?.isReady });

  const start = async () => {
    const r = await service.startGame({ roomId: room.id, playerId: player.id });
    if (!r.ok) pushToast(r.error.message, 'error');
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      pushToast('تم نسخ الرابط', 'success');
    } catch {
      pushToast(inviteUrl, 'info');
    }
  };

  return (
    <div className="flex h-full flex-col px-5 pb-6 pt-8">
      <button onClick={() => navigate('/')} className="text-sm text-white/50">
        ← {ar.common.back}
      </button>

      <div className="mt-6 text-center">
        <div className="text-sm text-white/50">{ar.modes[room.mode]}</div>
        <div className="mt-2 font-display text-sm text-white/60">{ar.room.codeLabel}</div>
        <div className="mt-1 font-display text-4xl font-extrabold tracking-[0.3em] text-brand-cyan">
          {room.code}
        </div>
        <button onClick={copyInvite} className="btn-ghost mt-4 text-sm">
          {ar.room.copyInvite}
        </button>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-sm text-white/60">
          <span>{ar.room.players}</span>
          <StatusPill status={room.status} />
        </div>
        <ul className="flex flex-col gap-2">
          {room.members.map((m) => (
            <li
              key={m.playerId}
              className="hud-panel flex items-center justify-between p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-purple text-sm font-bold">
                  {m.displayName.charAt(0)}
                </div>
                <span className="text-sm font-bold text-white">
                  {m.displayName}
                  {m.playerId === room.hostId && (
                    <span className="mr-2 text-[10px] text-brand-cyan">
                      {' '}
                      {ar.room.host}
                    </span>
                  )}
                </span>
              </div>
              <span
                className={`text-xs font-bold ${
                  m.isReady ? 'text-brand-green' : 'text-white/40'
                }`}
              >
                {m.isReady ? ar.room.ready : ar.room.notReady}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <button
          onClick={toggleReady}
          className={me?.isReady ? 'btn-ghost' : 'btn-primary'}
        >
          {me?.isReady ? ar.room.notReady : ar.room.ready}
        </button>
        {isHost && (
          <button
            onClick={start}
            disabled={room.status !== 'ready'}
            className="btn-success"
          >
            {ar.room.startMatch}
            {room.status !== 'ready' && (
              <span className="text-xs opacity-70">
                {' '}
                ({humans.length}/{room.mode === 'two_vs_two' ? 4 : 2})
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }): JSX.Element {
  const labelMap: Record<string, string> = {
    waiting: ar.room.waiting,
    ready: ar.room.readyStatus,
    in_progress: ar.game.yourTurn,
    completed: ar.results.title,
  };
  const tone = status === 'ready' ? 'text-brand-green' : 'text-white/50';
  return <span className={`text-xs ${tone}`}>{labelMap[status] ?? status}</span>;
}
