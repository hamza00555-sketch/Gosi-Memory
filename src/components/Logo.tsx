import { ar } from '../i18n/ar';

export type LogoSize = 'sm' | 'md' | 'lg';

interface LogoProps {
  size?: LogoSize;
  withTagline?: boolean;
  className?: string;
}

const WORD: Record<LogoSize, string> = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-6xl',
};

const ARC_HEIGHT: Record<LogoSize, string> = {
  sm: 'h-3',
  md: 'h-5',
  lg: 'h-8',
};

const TAGLINE: Record<LogoSize, string> = {
  sm: 'text-[11px]',
  md: 'text-sm',
  lg: 'text-base',
};

/**
 * The wordmark: قوس (an arc) drawn over the name, so the brand mark is the
 * word itself rather than a separate icon that would need an asset.
 */
export function Logo({ size = 'lg', withTagline = false, className = '' }: LogoProps): JSX.Element {
  return (
    <div className={`flex flex-col items-center gap-1.5 leading-none ${className}`}>
      <svg
        viewBox="0 0 200 56"
        preserveAspectRatio="none"
        aria-hidden="true"
        className={`w-full max-w-[14rem] ${ARC_HEIGHT[size]}`}
      >
        <defs>
          <linearGradient id="qawsi-arc" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#FFD84D" />
            <stop offset="50%" stopColor="#FF5FA2" />
            <stop offset="100%" stopColor="#54B8FF" />
          </linearGradient>
        </defs>
        <path
          d="M8 52 C 8 4, 192 4, 192 52"
          fill="none"
          stroke="url(#qawsi-arc)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle cx="8" cy="52" r="6" fill="#FFD84D" />
        <circle cx="192" cy="52" r="6" fill="#54B8FF" />
      </svg>

      <span className={`font-display font-black tracking-tight text-cream ${WORD[size]}`}>
        {ar.app.name}
      </span>

      {withTagline ? (
        <p className={`font-body font-medium text-cream/55 ${TAGLINE[size]}`}>{ar.app.tagline}</p>
      ) : null}
    </div>
  );
}

export default Logo;
