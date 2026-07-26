import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-4 py-2 text-base',
  md: 'min-h-[52px] px-6 py-3 text-lg',
  lg: 'min-h-[60px] px-7 py-4 text-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    icon,
    className = '',
    children,
    disabled,
    type,
    ...rest
  },
  ref,
): JSX.Element {
  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={[
        VARIANT[variant],
        SIZE[size],
        fullWidth ? 'w-full' : '',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pop-sky',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
});
