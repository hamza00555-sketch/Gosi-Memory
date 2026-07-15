import { useMemo } from 'react';
import type { Game } from '../../core/types/game';
import { useI18n } from '../../i18n';
import type { CardSet } from '../../lib/sets';
import { setAssetUrl } from '../../lib/sets';

/** Cheap stable string hash — only used to shuffle the mock table layout. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface MockPanelProps {
  set: CardSet;
  game: Game;
  onScan: (pairId: string, side: 'a' | 'b') => void;
}

/**
 * Simulation mode: the physical table, virtualized. Each printed card becomes
 * a tappable tile that emits the exact scan a camera would — so the full game
 * flow is playable on a desktop with no camera and no printed cards.
 */
export function MockPanel({ set, game, onScan }: MockPanelProps): JSX.Element {
  const { t } = useI18n();

  // Deterministic per-game layout so identical pairs are not adjacent
  // (the physical shuffle happens on the table; this stands in for it).
  const shuffled = useMemo(
    () => [...game.deck].sort((a, b) => hash(a.id + game.id) - hash(b.id + game.id)),
    [game.id, game.deck],
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <p className="mb-2 text-center text-xs text-white/60">{t.game.mockPanelHint}</p>
      <div className="grid grid-cols-4 gap-2">
        {shuffled.map((card) => {
          const pair = set.pairs.find((p) => p.pairId === card.pairId);
          if (!pair) return null;
          const showFace = card.isRevealed || card.isMatched;
          return (
            <button
              key={card.id}
              type="button"
              data-card-id={card.id}
              disabled={card.isMatched}
              onClick={() => onScan(card.pairId, card.side)}
              className={`relative aspect-square overflow-hidden rounded-xl border transition active:scale-95 ${
                card.isMatched
                  ? 'border-brand-green/60 opacity-60'
                  : showFace
                    ? 'border-brand-cyan shadow-glow'
                    : 'border-white/15 bg-gradient-to-br from-navy-700 to-navy-900'
              }`}
            >
              {showFace ? (
                <img
                  src={setAssetUrl(set.setId, pair.faceImage)}
                  alt={pair.pairId}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center font-display text-xl text-white/25">
                  ؟
                </span>
              )}
              <span className="absolute bottom-0 end-0 rounded-tl-lg bg-black/60 px-1 text-[9px] text-white/70">
                {card.side}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
