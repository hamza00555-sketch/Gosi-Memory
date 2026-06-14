import type { Game } from '../../core/types/game';
import { ar } from '../../i18n/ar';

interface PhraseSlotsProps {
  game: Game;
}

/**
 * Hidden-phrase display: each word is a slot that fills in as matches reveal it.
 * Reveal state is derived from game.revealedWords (word ids = `${id}:w${index}`)
 * so the UI never decides what is revealed — the engine does.
 */
export function PhraseSlots({ game }: PhraseSlotsProps): JSX.Element {
  const { hiddenPhrase, revealedWords } = game;
  const isRevealed = (index: number) =>
    revealedWords.includes(`${hiddenPhrase.id}:w${index}`);

  return (
    <div className="hud-panel p-3">
      <div className="mb-2 text-center text-[11px] tracking-wide text-white/50">
        {ar.game.hiddenPhrase} · {hiddenPhrase.category}
      </div>
      <div className="flex flex-wrap justify-center gap-2" dir="rtl">
        {hiddenPhrase.words.map((word, index) => {
          const shown = isRevealed(index);
          return (
            <span
              key={index}
              className={`rounded-lg border px-3 py-1.5 font-display text-base font-bold transition ${
                shown
                  ? 'border-brand-green/60 bg-brand-green/15 text-white'
                  : 'border-white/15 bg-white/5 text-transparent'
              }`}
            >
              {shown ? word : '•'.repeat(Math.max(2, word.length))}
            </span>
          );
        })}
      </div>
    </div>
  );
}
