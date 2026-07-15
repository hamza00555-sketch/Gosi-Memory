import { useI18n } from '../i18n';

interface LogoProps {
  size?: 'sm' | 'lg';
}

/** GOSI wordmark: Arabic primary with Latin subtitle. */
export function Logo({ size = 'lg' }: LogoProps): JSX.Element {
  const { t } = useI18n();
  const big = size === 'lg';
  return (
    <div className="flex flex-col items-center leading-none">
      <span
        className={`font-display font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-l from-brand-cyan via-brand-blue to-brand-purple ${
          big ? 'text-5xl' : 'text-2xl'
        }`}
      >
        {t.appName}
      </span>
      <span
        className={`mt-1 font-display font-bold tracking-[0.4em] text-white/50 ${
          big ? 'text-sm' : 'text-[10px]'
        }`}
      >
        {t.appNameLatin}
      </span>
    </div>
  );
}
