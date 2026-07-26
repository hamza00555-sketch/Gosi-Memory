import type { ReactNode } from 'react';
import { Button } from './Button';
import { ar } from '../i18n/ar';

interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel,
  action,
  className = '',
}: ErrorStateProps): JSX.Element {
  return (
    <div className={`flex flex-col items-center gap-4 px-6 py-10 text-center ${className}`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 text-bad" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" />
        <path
          d="M32 18v18"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="32" cy="45" r="3.2" fill="currentColor" />
      </svg>

      <h2 className="font-display text-2xl font-black text-cream">{title ?? ar.errors.generic}</h2>
      {body ? <p className="max-w-xs font-body text-base text-cream/65">{body}</p> : null}

      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel ?? ar.common.retry}
        </Button>
      ) : null}
      {action}
    </div>
  );
}

export default ErrorState;
