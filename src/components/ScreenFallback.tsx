import { ar } from '../i18n/ar';
import { Spinner } from './Spinner';

export function ScreenFallback(): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-ink-950">
      <div className="flex flex-col items-center gap-3 text-pop-yellow">
        <Spinner size="md" />
        <span className="font-body text-sm text-cream/60">{ar.common.loading}</span>
      </div>
    </div>
  );
}

export default ScreenFallback;
