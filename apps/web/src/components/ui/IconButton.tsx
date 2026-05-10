import type { ButtonHTMLAttributes } from 'react';
import { DISABLED, FOCUS_RING } from '../../lib/styles';

/**
 * Small pill-shaped button used for secondary actions throughout the app.
 * Supports multiple visual variants for different contexts (default toolbar
 * actions, destructive actions, ghost overlays, and elevated surfaces).
 *
 * When `hidden` is `true` the button fades out and becomes non-interactive
 * (`pointer-events-none`, `tabIndex={-1}`). This is used to animate controls
 * in/out without removing them from the DOM (which would cause layout shift).
 *
 * Accepts all native `<button>` attributes so `onClick`, `disabled`, `aria-*`,
 * etc. are passed through.
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * When `true`, the button is invisible and non-interactive but still occupies
   * layout space. Useful for conditionally showing controls without reflow.
   *
   * @default false
   */
  hidden?: boolean;
  /**
   * Visual style.
   * - `'default'` — bordered, used for most toolbar actions.
   * - `'danger'` — rose-tinted border, for irreversible actions needing caution.
   * - `'danger-filled'` — solid rose, for confirmed destructive actions.
   * - `'ghost'` — bordered with muted text, for secondary/cancel actions.
   * - `'elevated'` — surface background, used for the floating action buttons in `LinksToolbar`.
   *
   * @default 'default'
   */
  variant?: 'default' | 'danger' | 'danger-filled' | 'ghost' | 'elevated';
}

const FOCUS_RING_DANGER =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';

const variantClasses: Record<
  NonNullable<IconButtonProps['variant']>,
  string
> = {
  default: `pl-2 pr-2.5 py-1.5 hover:bg-[var(--bg-elevated)] ring-1 ring-[var(--border)] text-[var(--text)] ${FOCUS_RING} active:scale-[0.96]`,
  danger: `pl-2 pr-2.5 py-1.5 hover:bg-rose-100 [[data-mode='dark']_&]:hover:bg-rose-900/40 border border-rose-400 [[data-mode='dark']_&]:border-rose-700 text-rose-700 [[data-mode='dark']_&]:text-rose-300 ${FOCUS_RING_DANGER} active:scale-[0.96]`,
  'danger-filled': `pl-2 pr-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-rose-50 ${FOCUS_RING_DANGER} active:scale-[0.96]`,
  ghost: `pl-2 pr-2.5 py-1.5 ring-1 ring-[var(--border)] text-[var(--text-muted)] ${FOCUS_RING} active:scale-[0.96]`,
  elevated: `pl-3.5 pr-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border-shadow hover:border-shadow text-[var(--text)] font-semibold ${DISABLED} transition active:scale-[0.96] disabled:active:scale-100`,
};

export default function IconButton({
  className = '',
  children,
  hidden = false,
  variant = 'default',
  ...props
}: IconButtonProps) {
  const visibilityClasses = hidden
    ? 'opacity-0 scale-95 pointer-events-none'
    : 'opacity-100 scale-100';

  return (
    <button
      className={`inline-flex items-center gap-1.5 ${variantClasses[variant]} text-xs rounded-full cursor-pointer transition duration-200 ${visibilityClasses} ${className}`}
      type="button"
      tabIndex={hidden ? -1 : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
