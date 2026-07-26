interface StepArtProps {
  index: number;
  className?: string;
}

/**
 * One flat vector per onboarding beat. Drawn rather than illustrated so the
 * brand palette stays authoritative and nothing has to be downloaded.
 */
export function StepArt({ index, className = '' }: StepArtProps): JSX.Element {
  const common = `w-full max-w-[18rem] ${className}`;

  if (index === 0) {
    return (
      <svg viewBox="0 0 240 160" className={common} aria-hidden="true">
        <ellipse cx="120" cy="128" rx="96" ry="18" fill="#1E1B2E" />
        <rect x="24" y="34" width="72" height="102" rx="14" fill="#FF5F57" />
        <rect x="34" y="46" width="52" height="72" rx="8" fill="#141220" />
        <rect x="144" y="34" width="72" height="102" rx="14" fill="#8B5CF6" />
        <rect x="154" y="46" width="52" height="72" rx="8" fill="#141220" />
        <rect x="104" y="78" width="32" height="42" rx="6" fill="#FFD84D" />
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg viewBox="0 0 240 160" className={common} aria-hidden="true">
        <rect x="70" y="14" width="100" height="132" rx="18" fill="#1E1B2E" />
        <rect x="80" y="26" width="80" height="108" rx="10" fill="#0B0A10" />
        <rect x="96" y="62" width="48" height="60" rx="8" fill="#3A3355" />
        <path
          d="M100 62 C 100 30, 140 30, 140 62"
          fill="none"
          stroke="#3DE0C0"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="120" cy="46" r="9" fill="#FFD84D" />
        <rect x="88" y="88" width="64" height="4" rx="2" fill="#FF5FA2" />
      </svg>
    );
  }

  if (index === 2) {
    return (
      <svg viewBox="0 0 240 160" className={common} aria-hidden="true">
        <ellipse cx="120" cy="132" rx="94" ry="16" fill="#1E1B2E" />
        <rect x="36" y="30" width="76" height="98" rx="12" fill="#54B8FF" />
        <path d="M56 62h36M56 78h24" stroke="#0B0A10" strokeWidth="7" strokeLinecap="round" />
        <rect x="130" y="30" width="76" height="98" rx="12" fill="#FFD84D" />
        <circle cx="168" cy="72" r="18" fill="#0B0A10" />
        <path
          d="M124 24 C 152 6, 190 6, 214 24"
          fill="none"
          stroke="#FF5FA2"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="3 12"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 240 160" className={common} aria-hidden="true">
      <circle cx="82" cy="80" r="52" fill="#FF5FA2" opacity="0.18" />
      <path d="M92 26L58 88h26l-10 46 44-70H90z" fill="#FFD84D" />
      <rect x="140" y="42" width="72" height="72" rx="12" fill="#3DE0C0" />
      <rect x="152" y="54" width="22" height="22" rx="5" fill="#0B0A10" />
      <rect x="180" y="82" width="22" height="22" rx="5" fill="#0B0A10" />
      <rect x="180" y="54" width="22" height="22" rx="5" fill="#0B0A10" opacity="0.35" />
      <rect x="152" y="82" width="22" height="22" rx="5" fill="#0B0A10" opacity="0.35" />
    </svg>
  );
}

export default StepArt;
