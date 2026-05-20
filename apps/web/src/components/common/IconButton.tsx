import type { ButtonHTMLAttributes } from 'react';
import { DISABLED, FOCUS_RING, FOCUS_RING_DANGER } from '../../lib/styles';

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

const SMALL_PADDING = 'px-3 py-1.5';

const variantClasses: Record<
  NonNullable<IconButtonProps['variant']>,
  string
> = {
  default: `${SMALL_PADDING} hover:bg-[var(--bg-elevated)] ring-1 ring-[var(--border)] text-[var(--text)] ${FOCUS_RING}`,
  danger: `${SMALL_PADDING} hover:bg-rose-100 [[data-mode='dark']_&]:hover:bg-rose-900/40 border border-rose-400 [[data-mode='dark']_&]:border-rose-700 text-rose-700 [[data-mode='dark']_&]:text-rose-300 ${FOCUS_RING_DANGER}`,
  'danger-filled': `${SMALL_PADDING} bg-rose-600 hover:bg-rose-500 text-rose-50 ${FOCUS_RING_DANGER}`,
  ghost: `${SMALL_PADDING} ring-1 ring-[var(--border)] text-[var(--text-muted)] ${FOCUS_RING}`,
  elevated: `pl-3.5 pr-4 py-2 bg-[var(--bg-elevated)] disabled:bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border-shadow hover:border-shadow text-[var(--text)] font-semibold disabled:active:scale-100`,
};

export default function IconButton({
  className = '',
  children,
  disabled,
  hidden = false,
  variant = 'default',
  ...props
}: IconButtonProps) {
  const visibilityClasses = hidden
    ? 'opacity-0 scale-95 pointer-events-none'
    : 'opacity-100 scale-100';

  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 text-xs rounded-full cursor-pointer ${DISABLED} active:scale-[0.96] transition duration-200 ${variantClasses[variant]} ${visibilityClasses} ${className}`}
      type="button"
      // GOTCHA: use `disabled` rather than `aria-hidden` when `hidden`
      // is true. `aria-hidden` on a focusable element hides it from the
      // accessibility tree but leaves it reachable by Tab, which means
      // screen-reader users land on an element with no announced name or
      // role. `disabled` removes the button from the tab order and
      // prevents all AT interaction, which is the correct behavior for
      // an invisible control that is still mounted in the DOM.
      disabled={hidden || disabled}
      tabIndex={hidden ? -1 : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
