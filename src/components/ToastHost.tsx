import { useToastStore, type ToastTone } from '../state/toastStore';

const toneStyles: Record<ToastTone, string> = {
  info: 'border-brand-blue/40 bg-navy-800/90',
  success: 'border-brand-green/50 bg-navy-800/90',
  warning: 'border-yellow-400/50 bg-navy-800/90',
  error: 'border-red-400/50 bg-navy-800/90',
};

/** Global toast layer. Game events feed this through the toast store. */
export function ToastHost(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-2 text-center text-sm text-white shadow-lg backdrop-blur ${toneStyles[t.tone]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
