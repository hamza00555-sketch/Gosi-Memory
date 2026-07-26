import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  body?: string;
  /** Small decorative graphic; defaults to the arc motif. */
  art?: ReactNode;
  action?: ReactNode;
  className?: string;
}

function DefaultArt(): JSX.Element {
  return (
    <svg viewBox="0 0 80 48" className="h-12 w-20 text-cream/25" aria-hidden="true">
      <path
        d="M6 42 C 6 6, 74 6, 74 42"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="2 14"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  body,
  art,
  action,
  className = '',
}: EmptyStateProps): JSX.Element {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-10 text-center ${className}`}>
      {art ?? <DefaultArt />}
      <h2 className="font-display text-xl font-black text-cream/85">{title}</h2>
      {body ? <p className="max-w-xs font-body text-base text-cream/55">{body}</p> : null}
      {action}
    </div>
  );
}

export default EmptyState;
