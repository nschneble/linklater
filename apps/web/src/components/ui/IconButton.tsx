import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger' | 'danger-filled' | 'ghost' | 'elevated';
}

const variantClasses: Record<
  NonNullable<IconButtonProps['variant']>,
  string
> = {
  default:
    'px-2.5 py-1.5 hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
  danger:
    'px-2.5 py-1.5 hover:bg-rose-900/40 border border-rose-700 text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400',
  'danger-filled':
    'px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400',
  ghost:
    'px-2.5 py-1.5 border border-[var(--border)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
  elevated:
    'px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] font-semibold shadow-md disabled:opacity-60 transition disabled:cursor-wait',
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
