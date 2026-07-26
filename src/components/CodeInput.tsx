import { useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react';
import { ar } from '../i18n/ar';

const ALLOWED = /[^A-Z0-9]/g;

interface CodeInputProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  error?: string | null;
  autoFocus?: boolean;
}

function normalize(raw: string, length: number): string {
  return raw.toUpperCase().replace(ALLOWED, '').slice(0, length);
}

/**
 * Room-code entry. The boxes are laid out LTR because the code itself is Latin
 * and numeric — reversing it would make it unreadable against the host screen.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 4,
  disabled = false,
  error = null,
  autoFocus = false,
}: CodeInputProps): JSX.Element {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const slots = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (!autoFocus) return;
    refs.current[0]?.focus();
  }, [autoFocus]);

  const commit = useCallback(
    (next: string, focusIndex: number) => {
      onChange(next);
      const target = Math.min(length - 1, Math.max(0, focusIndex));
      refs.current[target]?.focus();
      if (next.length === length) onComplete?.(next);
    },
    [length, onChange, onComplete],
  );

  const handleChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const typed = normalize(event.target.value, length);
    if (typed.length === 0) {
      const cleared = slots.map((c, i) => (i === index ? '' : c)).join('');
      onChange(cleared);
      return;
    }
    // A paste or a fast typist can deliver several characters into one box.
    const chars = typed.split('');
    const next = slots.slice();
    chars.forEach((char, offset) => {
      const at = index + offset;
      if (at < length) next[at] = char;
    });
    commit(next.join(''), index + chars.length);
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Backspace') return;
    if (slots[index]) return;
    event.preventDefault();
    const next = slots.slice();
    if (index > 0) next[index - 1] = '';
    commit(next.join(''), index - 1);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = normalize(event.clipboardData.getData('text'), length);
    if (pasted.length === 0) return;
    event.preventDefault();
    commit(pasted, pasted.length);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div dir="ltr" className="flex justify-center gap-2.5">
        {slots.map((char, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            value={char}
            onChange={handleChange(index)}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste}
            onFocus={(e) => e.currentTarget.select()}
            disabled={disabled}
            type="text"
            inputMode="text"
            pattern="[A-Za-z0-9]*"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={length}
            aria-label={ar.lobby.codeLabel}
            className={`nums h-[4.5rem] w-[3.5rem] rounded-chunk bg-ink-800 text-center font-display text-4xl font-black uppercase text-cream outline-none ring-2 transition focus:ring-pop-yellow ${
              error ? 'ring-bad' : 'ring-transparent'
            }`}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="font-body text-sm font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default CodeInput;
