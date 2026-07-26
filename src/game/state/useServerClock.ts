import { useEffect, useRef, useState } from 'react';
import { getBackend } from '../../backend';

/**
 * A ticking, skew-corrected clock.
 *
 * Every deadline in the game — turn timer, challenge window, countdown — is
 * compared against server time rather than Date.now(), so two phones with
 * different clocks still agree on when time ran out. Components read the
 * countdown from here instead of each running their own interval.
 */
export function useServerClock(intervalMs = 100): number {
  const backend = getBackend();
  const [now, setNow] = useState(() => backend.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(backend.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [backend, intervalMs]);

  return now;
}

/** Whole seconds remaining until `deadline`, floored at zero. */
export function useCountdown(deadline: number | null, intervalMs = 100): number {
  const now = useServerClock(intervalMs);
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * Fire a callback once when a deadline passes, while this component is mounted.
 * Used by the host device to nudge phase advancement; guests ignore it.
 */
export function useDeadline(
  deadline: number | null,
  enabled: boolean,
  onElapsed: () => void,
): void {
  const backend = getBackend();
  const fired = useRef<number | null>(null);
  const cb = useRef(onElapsed);
  cb.current = onElapsed;

  useEffect(() => {
    if (!enabled || deadline === null) return;
    if (fired.current === deadline) return;

    const tick = () => {
      if (backend.now() >= deadline && fired.current !== deadline) {
        fired.current = deadline;
        cb.current();
      }
    };
    const id = window.setInterval(tick, 120);
    tick();
    return () => window.clearInterval(id);
  }, [backend, deadline, enabled]);
}
