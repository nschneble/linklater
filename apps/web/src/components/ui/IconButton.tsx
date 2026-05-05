import type { ButtonHTMLAttributes } from 'react';
import { DISABLED, FOCUS_RING } from '../../lib/styles';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger' | 'danger-filled' | 'ghost' | 'elevated';
}

const FOCUS_RING_DANGER =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';

const variantClasses: Record<
  NonNullable<IconButtonProps['variant']>,
  string
> = {
  default: `pl-2 pr-2.5 py-1.5 hover:bg-[var(--bg-elevated)] ring-1 ring-[var(--border)] text-[var(--text)] ${FOCUS_RING} active:scale-[0.96]`,
  danger: `pl-2 pr-2.5 py-1.5 hover:bg-rose-900/40 border border-rose-700 text-rose-300 ${FOCUS_RING_DANGER} active:scale-[0.96]`,
  'danger-filled': `pl-2 pr-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-rose-50 ${FOCUS_RING_DANGER} active:scale-[0.96]`,
  ghost: `pl-2 pr-2.5 py-1.5 ring-1 ring-[var(--border)] text-[var(--text-muted)] ${FOCUS_RING} active:scale-[0.96]`,
  elevated: `pl-3.5 pr-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border-shadow hover:border-shadow text-[var(--text)] font-semibold ${DISABLED} transition active:scale-[0.96] disabled:active:scale-100`,
};

export default function IconButton({
  className = '',
  children,
  variant = 'default',
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 ${variantClasses[variant]} text-xs rounded-full cursor-pointer ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
