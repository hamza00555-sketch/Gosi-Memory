import { MAX_PLAYERS_PER_TEAM, MIN_PLAYERS_PER_TEAM } from '../domain/teams';

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Describes the value for screen readers; the visible label lives outside. */
  label: string;
}

/**
 * Bounded counter. The cap is enforced by disabling the control rather than by
 * rejecting the press, so exceeding the roster limit is never even attempted.
 */
export function Stepper({
  value,
  onChange,
  min = MIN_PLAYERS_PER_TEAM,
  max = MAX_PLAYERS_PER_TEAM,
  disabled = false,
  label,
}: StepperProps): JSX.Element {
  const clamped = Math.min(max, Math.max(min, value));
  const canDecrease = !disabled && clamped > min;
  const canIncrease = !disabled && clamped < max;

  const button =
    'flex h-14 w-14 shrink-0 items-center justify-center rounded-pill bg-ink-700 font-display text-3xl font-black text-cream shadow-chunk-sm transition active:translate-y-0.5 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pop-sky';

  return (
    <div className="flex items-center justify-between gap-4" role="group" aria-label={label}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(clamped - 1)}
        disabled={!canDecrease}
        aria-label={`${label} −`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </button>

      <output
        aria-live="polite"
        className="nums flex-1 text-center font-display text-4xl font-black text-cream"
      >
        {clamped}
      </output>

      <button
        type="button"
        className={button}
        onClick={() => onChange(clamped + 1)}
        disabled={!canIncrease}
        aria-label={`${label} +`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path
            d="M12 6v12M6 12h12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default Stepper;
