import { Link } from 'react-router-dom';
import { Logo } from './Logo';

interface AppHeaderProps {
  title?: string;
  backTo?: string;
}

/** Simple sub-screen header: back link + title + small wordmark. */
export function AppHeader({ title, backTo = '/' }: AppHeaderProps): JSX.Element {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3">
      <Link
        to={backTo}
        className="btn-ghost px-3 py-2 text-sm"
        aria-label="back"
      >
        <span className="inline-block rtl:rotate-180">←</span>
      </Link>
      <h1 className="flex-1 truncate text-center font-display text-lg font-bold text-white">
        {title}
      </h1>
      <Logo size="sm" />
    </header>
  );
}
