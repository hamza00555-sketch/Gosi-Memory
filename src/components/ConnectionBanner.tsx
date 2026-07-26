import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ConnectionStatus } from '../backend/types';
import { ar } from '../i18n/ar';
import { Spinner } from './Spinner';

const RESTORED_MS = 2200;

interface ConnectionBannerProps {
  status: ConnectionStatus;
  /** The host device is unreachable — the match cannot advance. */
  hostAbsent?: boolean;
  /** The other team's device dropped, but play can continue. */
  otherAbsent?: boolean;
}

type Tone = 'warn' | 'pause' | 'good';

const TONE: Record<Tone, string> = {
  warn: 'bg-pop-yellow text-ink-950',
  pause: 'bg-ink-800 text-cream',
  good: 'bg-good text-ink-950',
};

/**
 * A thin, non-blocking strip — except host-absent, which reads as an explicit
 * pause because nothing in the match can progress without the host.
 */
export function ConnectionBanner({
  status,
  hostAbsent = false,
  otherAbsent = false,
}: ConnectionBannerProps): JSX.Element | null {
  const [showRestored, setShowRestored] = useState(false);
  const wasDown = useRef(false);

  useEffect(() => {
    if (status !== 'online') {
      wasDown.current = true;
      setShowRestored(false);
      return;
    }
    if (!wasDown.current) return;
    wasDown.current = false;
    setShowRestored(true);
    const id = window.setTimeout(() => setShowRestored(false), RESTORED_MS);
    return () => window.clearTimeout(id);
  }, [status]);

  const paused = hostAbsent || status === 'host_absent';

  let tone: Tone | null = null;
  let title: string | null = null;
  let body: string | null = null;
  let busy = false;

  if (paused) {
    tone = 'pause';
    title = ar.connection.hostGone;
    body = ar.connection.hostGoneBody;
  } else if (status === 'offline') {
    tone = 'warn';
    title = ar.connection.offline;
  } else if (status === 'connecting') {
    tone = 'warn';
    title = ar.connection.reconnecting;
    busy = true;
  } else if (otherAbsent) {
    tone = 'warn';
    title = ar.connection.otherGone;
  } else if (showRestored) {
    tone = 'good';
    title = ar.connection.restored;
  }

  return (
    <AnimatePresence initial={false}>
      {tone && title ? (
        <motion.div
          key={title}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="shrink-0 overflow-hidden"
          role="status"
          aria-live="polite"
        >
          <div className={`flex items-center gap-3 px-5 py-3 ${TONE[tone]}`}>
            {busy ? <Spinner size="sm" /> : null}
            {paused ? (
              <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
                <span className="absolute inset-0 animate-pulse-ring rounded-pill text-pop-yellow" />
                <span className="h-3 w-3 rounded-pill bg-pop-yellow" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold">{title}</p>
              {body ? <p className="font-body text-sm opacity-75">{body}</p> : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default ConnectionBanner;
