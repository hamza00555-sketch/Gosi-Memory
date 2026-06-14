import { useCallbackRef } from '../../hooks/useCallbackRef';
import { useEffect, useRef, useState } from 'react';
import { getDefaultConfig } from '../../core/engine/config';
import { isPlayersTurn } from '../../core/engine/selectors';
import type { Game } from '../../core/types/game';
import { getGameService } from '../../services';
import { useToastStore } from '../../state/toastStore';
import { ar } from '../../i18n/ar';

interface MatchController {
  game: Game | null;
  myTurn: boolean;
  busy: boolean;
  remainingMs: number;
  selectCard: (cardId: string) => void;
  solve: (guess: string) => Promise<boolean>;
}

/**
 * Single owner of all in-match side effects for the local player:
 * - sends card selections (intent only; the engine decides outcomes)
 * - auto-acknowledges the brief reveal after a pair resolves
 * - runs the turn timer and reports timeouts
 * Components render from `game`; they never call the service directly.
 */
export function useMatchController(
  game: Game | null,
  playerId: string,
): MatchController {
  const service = getGameService();
  const pushToast = useToastStore((s) => s.push);
  const [busy, setBusy] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const ackScheduled = useRef(false);

  const config = game ? getDefaultConfig(game.mode) : null;
  const myTurn = game ? isPlayersTurn(game, playerId) : false;

  // Auto-acknowledge the reveal (only the active player drives this).
  const onResolve = useCallbackRef(() => {
    if (!game || !config) return;
    if (game.phase !== 'resolving' || !myTurn || ackScheduled.current) return;
    ackScheduled.current = true;

    const matched = game.selection
      .map((id) => game.deck.find((c) => c.id === id))
      .every((c) => c?.isMatched);
    pushToast(matched ? ar.game.matched : ar.game.missed, matched ? 'success' : 'warning');

    const delay = matched ? 450 : config.mismatchRevealMs;
    window.setTimeout(async () => {
      await service.acknowledgeReveal({
        roomId: game.roomId,
        gameId: game.id,
        playerId,
      });
      ackScheduled.current = false;
    }, delay);
  });

  useEffect(() => {
    onResolve();
  }, [game?.phase, game?.version, onResolve]);

  // Turn timer.
  useEffect(() => {
    if (!game || !config || config.turnTimerMs <= 0 || game.status !== 'in_progress') {
      setRemainingMs(0);
      return;
    }
    if (!myTurn || game.phase === 'resolving') {
      setRemainingMs(config.turnTimerMs);
      return;
    }
    const deadline = Date.now() + config.turnTimerMs;
    setRemainingMs(config.turnTimerMs);
    const tick = window.setInterval(() => {
      const left = deadline - Date.now();
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(tick);
        void service.reportTimeout({ roomId: game.roomId, gameId: game.id, playerId });
      }
    }, 200);
    return () => window.clearInterval(tick);
  }, [game?.turnIndex, game?.phase, myTurn, config, game, playerId, service]);

  const selectCard = useCallbackRef((cardId: string) => {
    if (!game || !myTurn || busy) return;
    if (game.phase !== 'selecting_first' && game.phase !== 'selecting_second') return;
    setBusy(true);
    void service
      .submitMove({ roomId: game.roomId, gameId: game.id, playerId, cardId })
      .then((r) => {
        if (!r.ok) pushToast(r.error.message, 'error');
        setBusy(false);
      });
  });

  const solve = useCallbackRef(async (guess: string): Promise<boolean> => {
    if (!game) return false;
    const r = await service.attemptSolvePhrase({
      roomId: game.roomId,
      gameId: game.id,
      playerId,
      guess,
    });
    if (!r.ok) {
      pushToast(r.error.message, 'error');
      return false;
    }
    return r.value.status === 'completed';
  });

  return { game, myTurn, busy, remainingMs, selectCard, solve };
}
