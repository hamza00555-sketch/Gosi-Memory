import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getDefaultConfig } from '../../core/engine/config';
import { reduce } from '../../core/engine/engine';
import type { GameEvent } from '../../core/engine/actions';
import type { MoveErrorCode } from '../../core/engine/errors';
import type { CardSide } from '../../core/types/card';
import type { Game } from '../../core/types/game';
import type { CardId, PairId } from '../../core/types/ids';
import { useMatchStore } from '../../state/matchStore';

export interface MatchEffects {
  /** A card was legally revealed (object appeared). */
  onRevealed?: (cardId: CardId, pairId: PairId) => void;
  onMatched?: (cardIds: [CardId, CardId], pairId: PairId) => void;
  onMissed?: (cardIds: [CardId, CardId]) => void;
  onTurnPassed?: (toPlayerId: string) => void;
  onCompleted?: (winnerId: string | null) => void;
  /** An illegal scan the player should hear about (already matched, etc.). */
  onRejected?: (code: MoveErrorCode) => void;
}

/**
 * Bridges recognition to the pure engine: scans become SELECT_CARD actions,
 * resolutions schedule END_REVEAL after the configured reveal delay, and
 * engine events fan out as UI effects. All game RULES stay in the engine —
 * this hook only sequences time and side effects.
 */
export function useMatchController(effects: MatchEffects) {
  const game = useMatchStore((s) => s.game);
  const updateGame = useMatchStore((s) => s.updateGame);

  const gameRef = useRef<Game | null>(game);
  gameRef.current = game;

  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Scans that arrived DURING the resolve window (players flip the next card
   * faster than the banner). The tracker only fires `found` once per sighting,
   * so a rejected-for-timing scan must be replayed after END_REVEAL or the
   * flip would be silently swallowed.
   */
  const pendingScans = useRef<Map<CardId, number>>(new Map());
  const applyScanRef = useRef<(cardId: CardId) => void>(() => undefined);
  const PENDING_TTL_MS = 4000;

  const config = useMemo(
    () => getDefaultConfig(game?.mode ?? 'solo'),
    [game?.mode],
  );

  useEffect(
    () => () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    },
    [],
  );

  const runEvents = useCallback((events: GameEvent[], next: Game) => {
    const fx = effectsRef.current;
    for (const e of events) {
      switch (e.type) {
        case 'CARD_REVEALED': {
          const card = next.deck.find((c) => c.id === e.cardId);
          if (card) fx.onRevealed?.(e.cardId, card.pairId);
          break;
        }
        case 'PAIR_MATCHED':
          fx.onMatched?.(e.cardIds, e.pairId);
          break;
        case 'PAIR_MISSED':
          fx.onMissed?.(e.cardIds);
          break;
        case 'TURN_PASSED':
          fx.onTurnPassed?.(e.to);
          break;
        case 'GAME_COMPLETED':
          fx.onCompleted?.(e.winnerId);
          break;
        default: {
          const _never: never = e;
          void _never;
        }
      }
    }
  }, []);

  const endReveal = useCallback(() => {
    const current = gameRef.current;
    if (!current || current.phase !== 'resolving') return;
    const res = reduce(current, { type: 'END_REVEAL' }, config, Date.now());
    if (!res.ok) return;
    // Synchronous ref update: two scans can land in the SAME frame (two QR
    // codes in one camera pass) — waiting for React's re-render would make
    // the second scan read stale state and clobber the first.
    gameRef.current = res.value.game;
    updateGame(res.value.game);
    runEvents(res.value.events, res.value.game);

    // Replay fresh scans that were rejected only because we were resolving.
    const now = Date.now();
    const queued = [...pendingScans.current.entries()];
    pendingScans.current.clear();
    for (const [cardId, at] of queued) {
      if (now - at <= PENDING_TTL_MS) applyScanRef.current(cardId);
    }
  }, [config, runEvents, updateGame]);

  /** Feed one recognized card into the game. Safe to call with noise. */
  const applyScan = useCallback(
    (cardId: CardId) => {
      const current = gameRef.current;
      if (!current) return;
      const res = reduce(current, { type: 'SELECT_CARD', cardId }, config, Date.now());
      if (!res.ok) {
        if (res.error.code === 'WRONG_PHASE' && current.phase === 'resolving') {
          // Flipped the next card during the resolve banner — replay it later.
          pendingScans.current.set(cardId, Date.now());
        } else if (
          res.error.code === 'CARD_ALREADY_MATCHED' ||
          res.error.code === 'CARD_ALREADY_SELECTED'
        ) {
          effectsRef.current.onRejected?.(res.error.code);
        }
        return;
      }
      const { game: next, events } = res.value;
      gameRef.current = next; // see endReveal: same-frame scan race
      updateGame(next);
      runEvents(events, next);

      if (next.phase === 'resolving') {
        const wasMatch = events.some((e) => e.type === 'PAIR_MATCHED');
        const delay = wasMatch ? config.matchRevealMs : config.mismatchRevealMs;
        if (revealTimer.current) clearTimeout(revealTimer.current);
        revealTimer.current = setTimeout(endReveal, delay);
      }
    },
    [config, endReveal, runEvents, updateGame],
  );

  /**
   * Image tracking can't tell the two identical faces of a pair apart — pick
   * the copy that makes sense: not matched, not already face-up this turn.
   */
  const resolveSide = useCallback((pairId: PairId): CardSide | null => {
    const current = gameRef.current;
    if (!current) return null;
    const candidates = current.deck.filter((c) => c.pairId === pairId && !c.isMatched);
    const free = candidates.find((c) => !current.selection.includes(c.id));
    return (free?.side ?? null) as CardSide | null;
  }, []);

  applyScanRef.current = applyScan;

  return { game, config, applyScan, resolveSide };
}
