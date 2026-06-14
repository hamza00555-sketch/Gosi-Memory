import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArProvider, CameraHud, useAr } from '../../ar';
import { remainingWords } from '../../core/engine/selectors';
import { useRoomGame } from '../../hooks/useRoomGame';
import { useSessionStore } from '../../state/sessionStore';
import { useToastStore } from '../../state/toastStore';
import { ar } from '../../i18n/ar';
import { useMatchController } from './useMatchController';
import { HudTopBar } from './HudTopBar';
import { PhraseSlots } from './PhraseSlots';
import { CardGrid } from './CardGrid';
import { SolveSheet } from './SolveSheet';

export default function GameScreen(): JSX.Element {
  return (
    <ArProvider>
      <GameScreenInner />
    </ArProvider>
  );
}

function GameScreenInner(): JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const player = useSessionStore((s) => s.player);
  const pushToast = useToastStore((s) => s.push);
  const { room, game } = useRoomGame(roomId);
  const { adapter } = useAr();

  const controller = useMatchController(game, player.id);
  const selectCard = controller.selectCard; // stable identity (useCallbackRef)
  const [solveOpen, setSolveOpen] = useState(false);

  // AR seam: the adapter turns a scan into a card selection. Today taps drive
  // it via simulateScan; a real recognizer would emit the same events.
  useEffect(() => {
    void adapter.start();
    const unsub = adapter.onScan((result) => selectCard(result.cardId));
    return () => {
      unsub();
      adapter.stop();
    };
  }, [adapter, selectCard]);

  // Leave for the results screen when the game completes.
  useEffect(() => {
    if (game?.status === 'completed') {
      const t = window.setTimeout(() => navigate(`/results/${roomId}`), 900);
      return () => window.clearTimeout(t);
    }
  }, [game?.status, navigate, roomId]);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    room?.members.forEach((m) => (map[m.playerId] = m.displayName));
    return map;
  }, [room]);

  if (!game) {
    return (
      <div className="flex h-full items-center justify-center text-white/60">
        {ar.common.loading}
      </div>
    );
  }

  const showHint = () => {
    const left = remainingWords(game);
    pushToast(`${ar.game.hint}: ${game.hiddenPhrase.category} · ${left} كلمات مخفية`, 'info');
  };

  return (
    <CameraHud>
      <HudTopBar
        game={game}
        names={names}
        meId={player.id}
        remainingMs={controller.remainingMs}
      />

      <div className="px-3">
        <PhraseSlots game={game} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <CardGrid
          cards={game.deck}
          disabled={!controller.myTurn || game.phase === 'resolving'}
          onScan={(cardId) => adapter.simulateScan(cardId)}
        />
      </div>

      <div className="flex items-center gap-3 p-3">
        <button onClick={showHint} className="btn-ghost flex-1">
          💡 {ar.game.hint}
        </button>
        <button
          onClick={() => setSolveOpen(true)}
          disabled={!controller.myTurn}
          className="btn-success flex-[2]"
        >
          ✶ {ar.game.solve}
        </button>
      </div>

      <SolveSheet
        open={solveOpen}
        onClose={() => setSolveOpen(false)}
        onSubmit={async (guess) => {
          const won = await controller.solve(guess);
          setSolveOpen(false);
          if (won) pushToast(ar.results.youWon, 'success');
        }}
      />
    </CameraHud>
  );
}
