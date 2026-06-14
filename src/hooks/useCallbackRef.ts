import { useCallback, useRef } from 'react';

/**
 * Returns a stable function identity that always invokes the latest callback.
 * Avoids stale closures in effects without forcing effect re-runs on every
 * render — useful for the match controller's timers and async handlers.
 */
export function useCallbackRef<Args extends unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: Args) => ref.current(...args), []);
}
