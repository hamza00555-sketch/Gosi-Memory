import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ar } from '../../../i18n/ar';

interface Props {
  /** One zone per teammate, capped at three. */
  zones: number;
  disabled: boolean;
  /** Reports how many zones were held at once, at the peak. */
  onComplete: (heldSimultaneously: number) => void;
}

const HOLD_MS = 600;

/**
 * The only genuinely co-operative mini-game: every teammate presses a zone and
 * all of them must be held together. Uses pointer events with capture so a
 * finger sliding slightly does not drop its zone, which is what makes a
 * three-finger hold achievable on a phone.
 */
export function TeamSync({ zones, disabled, onComplete }: Props): JSX.Element {
  const [held, setHeld] = useState<Set<number>>(() => new Set());
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);
  const startedAt = useRef<number | null>(null);

  const allHeld = held.size >= zones;

  useEffect(() => {
    if (!allHeld || completedRef.current) {
      startedAt.current = null;
      setProgress(0);
      return;
    }
    startedAt.current = performance.now();
    let raf = 0;
    const tick = (): void => {
      if (startedAt.current === null) return;
      const elapsed = performance.now() - startedAt.current;
      setProgress(Math.min(1, elapsed / HOLD_MS));
      if (elapsed >= HOLD_MS) {
        completedRef.current = true;
        onComplete(zones);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [allHeld, zones, onComplete]);

  const grab = useCallback((index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setHeld((prev) => new Set(prev).add(index));
  }, []);

  const release = useCallback((index: number) => {
    setHeld((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-5" style={{ touchAction: 'none' }}>
      <p className="font-display text-xl text-cream/70">
        {allHeld ? ar.challenge.syncHolding : ar.challenge.syncHold}
      </p>

      <div className="flex w-full items-center justify-center gap-4">
        {Array.from({ length: zones }, (_, index) => {
          const active = held.has(index);
          return (
            <motion.button
              key={index}
              type="button"
              disabled={disabled}
              animate={{ scale: active ? 1.08 : 1 }}
              transition={{ type: 'spring', stiffness: 600, damping: 18 }}
              onPointerDown={(e) => grab(index, e)}
              onPointerUp={() => release(index)}
              onPointerCancel={() => release(index)}
              onPointerLeave={() => release(index)}
              aria-pressed={active}
              className={`h-28 flex-1 rounded-full transition-colors ${
                active ? 'bg-pop-mint' : 'bg-ink-700'
              }`}
            />
          );
        })}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-pill bg-ink-800">
        <div
          className="h-full rounded-pill bg-pop-yellow transition-[width] duration-75"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
