import { ar } from '../../i18n/ar';
import type { GameMode } from '../../core/types/room';

const ICONS: Record<GameMode, string> = {
  solo_ai: '🤖',
  one_vs_one: '⚔️',
  two_vs_two: '🛡️',
};

interface ModeCardProps {
  mode: GameMode;
  selected: boolean;
  onSelect: () => void;
}

export function ModeCard({ mode, selected, onSelect }: ModeCardProps): JSX.Element {
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-4 rounded-2xl border p-4 text-right transition ${
        selected
          ? 'border-brand-cyan bg-brand-cyan/10 shadow-glow'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <span className="text-3xl">{ICONS[mode]}</span>
      <span className="flex flex-1 flex-col">
        <span className="font-display text-lg font-bold text-white">
          {ar.modes[mode]}
        </span>
        <span className="text-xs text-white/50">{ar.modeDesc[mode]}</span>
      </span>
      <span
        className={`h-4 w-4 rounded-full border-2 ${
          selected ? 'border-brand-cyan bg-brand-cyan' : 'border-white/30'
        }`}
      />
    </button>
  );
}
