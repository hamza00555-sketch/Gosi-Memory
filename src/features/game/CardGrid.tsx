import type { Card } from '../../core/types/card';
import { glyphFor } from './faceAssets';

interface CardGridProps {
  cards: Card[];
  disabled: boolean;
  onScan: (cardId: string) => void;
}

/**
 * The tappable card grid. A tap is a "scan" — it routes through the AR adapter
 * seam in the parent, so swapping in real recognition later changes nothing
 * here. Matched/revealed visuals are driven purely by authoritative card state.
 */
export function CardGrid({ cards, disabled, onScan }: CardGridProps): JSX.Element {
  const ordered = [...cards].sort((a, b) => a.position - b.position);
  const cols = ordered.length <= 12 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className={`grid ${cols} gap-2.5`}>
      {ordered.map((card) => (
        <CardTile key={card.id} card={card} disabled={disabled} onScan={onScan} />
      ))}
    </div>
  );
}

function CardTile({
  card,
  disabled,
  onScan,
}: {
  card: Card;
  disabled: boolean;
  onScan: (id: string) => void;
}): JSX.Element {
  const faceUp = card.isRevealed || card.isMatched;
  const interactive = !disabled && !faceUp;

  return (
    <button
      disabled={!interactive}
      onClick={() => onScan(card.id)}
      className={`relative aspect-[3/4] rounded-xl border text-3xl transition ${
        card.isMatched
          ? 'border-brand-green/70 bg-brand-green/15 shadow-glow-green'
          : faceUp
            ? 'animate-flip-in border-brand-cyan/70 bg-navy-700'
            : interactive
              ? 'border-hud-line bg-navy-800/80 active:scale-95'
              : 'border-white/10 bg-navy-800/50'
      }`}
    >
      <span className="absolute inset-0 flex items-center justify-center">
        {faceUp ? (
          glyphFor(card.faceAssetId)
        ) : (
          <span className="font-display text-lg font-bold text-brand-cyan/40">قوسي</span>
        )}
      </span>
    </button>
  );
}
