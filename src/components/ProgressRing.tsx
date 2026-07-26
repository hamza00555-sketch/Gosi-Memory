import type { ReactNode } from 'react';

interface ProgressRingProps {
  /** 0..1. Values outside the range are clamped. */
  value: number;
  size?: number;
  stroke?: number;
  /** Any Tailwind text-* colour; the arc inherits it. */
  className?: string;
  trackClassName?: string;
  children?: ReactNode;
  label?: string;
}

export function ProgressRing({
  value,
  size = 96,
  stroke = 10,
  className = 'text-pop-yellow',
  trackClassName = 'text-white/10',
  children,
  label,
}: ProgressRingProps): JSX.Element {
  const clamped = Math.min(1, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          className={trackClassName}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={`${className} transition-[stroke-dashoffset] duration-300 ease-out`}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      ) : null}
    </div>
  );
}

export default ProgressRing;
