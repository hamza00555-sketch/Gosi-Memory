import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { BottomNav } from '../../components/BottomNav';
import { ar } from '../../i18n/ar';
import { useSessionStore } from '../../state/sessionStore';
import { useToastStore } from '../../state/toastStore';
import { getGameService } from '../../services';
import { AI_PLAYER_ID } from '../../services/local/LocalGameService';
import type { GameMode } from '../../core/types/room';
import { ModeCard } from './ModeCard';

const MODES: GameMode[] = ['solo_ai', 'one_vs_one', 'two_vs_two'];

export default function LobbyScreen(): JSX.Element {
  const navigate = useNavigate();
  const player = useSessionStore((s) => s.player);
  const pushToast = useToastStore((s) => s.push);
  const [mode, setMode] = useState<GameMode>('solo_ai');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    const service = getGameService();
    const host = {
      playerId: player.id,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
    };
    const created = await service.createRoom({ mode, host, difficulty: 'medium' });
    if (!created.ok) {
      pushToast(created.error.message, 'error');
      setBusy(false);
      return;
    }
    const room = created.value;

    if (mode === 'solo_ai') {
      // Solo: ready up and jump straight into the match.
      await service.setReady({ roomId: room.id, playerId: player.id, isReady: true });
      const started = await service.startGame({ roomId: room.id, playerId: player.id });
      setBusy(false);
      if (!started.ok) return pushToast(started.error.message, 'error');
      navigate(`/game/${room.id}`);
      return;
    }

    setBusy(false);
    navigate(`/room/${room.id}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-8">
        <header className="flex items-start justify-between">
          <ProfileChip
            name={player.displayName}
            level={player.level}
            coins={player.coins}
          />
        </header>

        <div className="mt-8 flex justify-center">
          <Logo />
        </div>
        <p className="mt-3 text-center text-sm text-white/50">{ar.tagline}</p>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold text-white/70">{ar.lobby.chooseMode}</h2>
          <div className="grid grid-cols-1 gap-3">
            {MODES.map((m) => (
              <ModeCard
                key={m}
                mode={m}
                selected={mode === m}
                onSelect={() => setMode(m)}
              />
            ))}
          </div>
        </section>

        <button className="btn-primary mt-6 w-full text-lg" onClick={start} disabled={busy}>
          {busy ? ar.common.loading : ar.lobby.start}
        </button>

        <section className="mt-8 grid grid-cols-2 gap-3">
          <PreviewCard
            title={ar.lobby.storePreview}
            hint="أظهر، تأثيرات، AR"
            onClick={() => navigate('/store')}
          />
          <PreviewCard title={ar.lobby.missionsPreview} hint="٣ مهام جديدة" />
        </section>

        {/* Hidden in solo; only relevant context shown to avoid clutter */}
        <p className="mt-6 text-center text-[11px] text-white/30">
          الخصم الافتراضي: {AI_PLAYER_ID === 'ai_bot' ? 'القوسي' : ''}
        </p>
      </div>

      <BottomNav />
    </div>
  );
}

function ProfileChip({
  name,
  level,
  coins,
}: {
  name: string;
  level: number;
  coins: number;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-purple font-display text-lg font-bold">
        {name.charAt(0)}
      </div>
      <div className="text-sm">
        <div className="font-bold text-white">{name}</div>
        <div className="text-white/50">
          {ar.lobby.level} {level}
        </div>
      </div>
      <div className="mr-2 rounded-full bg-white/5 px-3 py-1 text-sm font-bold text-brand-cyan">
        {coins} ✦
      </div>
    </div>
  );
}

function PreviewCard({
  title,
  hint,
  onClick,
}: {
  title: string;
  hint: string;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="hud-panel flex flex-col items-start gap-1 p-4 text-right transition hover:border-brand-cyan/60"
    >
      <span className="font-display font-bold text-white">{title}</span>
      <span className="text-xs text-white/40">{hint}</span>
    </button>
  );
}
