import type { TeamColor } from '../domain/teams';
import { TEAM_COLORS } from '../domain/teams';
import { ar } from '../i18n/ar';
import { teamTokens } from './teamColors';

interface ColorPickerProps {
  value: TeamColor;
  onChange: (color: TeamColor) => void;
  /** The other team's colour — shown, but not selectable. */
  taken?: TeamColor | null;
  disabled?: boolean;
  label: string;
}

export function ColorPicker({
  value,
  onChange,
  taken = null,
  disabled = false,
  label,
}: ColorPickerProps): JSX.Element {
  return (
    <div className="flex gap-3" role="radiogroup" aria-label={label}>
      {TEAM_COLORS.map((color) => {
        const tokens = teamTokens(color);
        const isTaken = taken === color && value !== color;
        const selected = value === color;

        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={isTaken ? `${label} — ${ar.setup.colorTaken}` : label}
            disabled={disabled || isTaken}
            onClick={() => onChange(color)}
            className={`relative h-14 w-14 shrink-0 rounded-chunk transition ${tokens.fill} ${
              selected ? 'ring-4 ring-cream' : 'ring-0'
            } ${isTaken ? 'opacity-30' : 'active:scale-95'} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pop-sky`}
          >
            {isTaken ? (
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full p-3 text-ink-950" aria-hidden="true">
                <path d="M5 19L19 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : null}
            {selected ? (
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full p-3.5 text-ink-950" aria-hidden="true">
                <path
                  d="M5 13l4 4L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default ColorPicker;
