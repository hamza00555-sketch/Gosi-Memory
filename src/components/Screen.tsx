import type { ReactNode } from 'react';
import { ar } from '../i18n/ar';

interface ScreenProps {
  title?: string;
  subtitle?: string;
  /** Renders a back control in the header when provided. */
  onBack?: () => void;
  /** Full-bleed strip above the header — connection banners live here. */
  banner?: ReactNode;
  /** Trailing header slot, e.g. a sound toggle. */
  action?: ReactNode;
  /** Pinned action area in the bottom third, within the safe inset. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Page shell. Owns the safe-area padding and the scroll boundary so the footer
 * action area stays reachable with one thumb while the body scrolls.
 */
export function Screen({
  title,
  subtitle,
  onBack,
  banner,
  action,
  footer,
  children,
  className = '',
  contentClassName = '',
}: ScreenProps): JSX.Element {
  const hasHeader = Boolean(title || onBack || action);

  return (
    <div className={`screen h-full bg-ink-950 ${className}`}>
      {banner}

      {hasHeader ? (
        <header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={ar.common.back}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-white/10 text-cream transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pop-sky"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path
                  d="M9 5l7 7-7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            {title ? (
              <h1 className="truncate font-display text-2xl font-black text-cream">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="truncate font-body text-sm text-cream/60">{subtitle}</p>
            ) : null}
          </div>

          {action}
        </header>
      ) : null}

      <main className={`min-h-0 flex-1 overflow-y-auto px-5 pb-6 ${contentClassName}`}>
        {children}
      </main>

      {footer ? (
        <div className="shrink-0 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent px-5 pb-5 pt-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export default Screen;
