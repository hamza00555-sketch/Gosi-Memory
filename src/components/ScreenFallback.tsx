import { ar } from '../i18n/ar';

export function ScreenFallback(): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-navy-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        <span className="text-sm text-white/60">{ar.common.loading}</span>
      </div>
    </div>
  );
}
