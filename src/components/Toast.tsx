import { motion } from 'framer-motion';
import type { ToastItem } from '../state/toastStore';
import { ar } from '../i18n/ar';

const VARIANT: Record<ToastItem['variant'], string> = {
  info: 'bg-ink-800 text-cream',
  success: 'bg-good text-ink-950',
  error: 'bg-bad text-cream',
};

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps): JSX.Element {
  return (
    <motion.div
      layout
      initial={{ y: -24, opacity: 0, scale: 0.94 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -16, opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={`pointer-events-auto flex w-full items-center gap-3 rounded-chunk px-4 py-3 shadow-lift ${VARIANT[toast.variant]}`}
    >
      <span className="min-w-0 flex-1 font-body text-base font-medium">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={ar.common.close}
        className="-me-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-current opacity-70 transition active:scale-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pop-sky"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </motion.div>
  );
}
