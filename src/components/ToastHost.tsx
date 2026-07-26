import { AnimatePresence } from 'framer-motion';
import { Toast } from './Toast';
import { useToastStore } from '../state/toastStore';

/** Mounted once, above every screen. */
export function ToastHost(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-stretch gap-2 px-4"
      style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ToastHost;
