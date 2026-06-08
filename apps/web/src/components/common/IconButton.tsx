import type { ButtonHTMLAttributes, Ref } from 'react';
import { DISABLED, FOCUS_RING, FOCUS_RING_DANGER } from '../../lib/styles';

/**
 * Small pill-shaped button used for secondary actions throughout the app.
 *
 * When `hidden` is `true` the button fades out and becomes non-interactive
 * (`pointer-events-none`, `tabIndex={-1}`). This is used to animate controls
 * in/out without removing them from the DOM (which would cause layout shift).
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * When `true`, the button is invisible and non-interactive but still occupies
   * layout space. Useful for conditionally showing controls without reflow.
   */
  hidden?: boolean;
  /**
   * Visual style.
   * - `'default'` — bordered, used for most toolbar actions.
   * - `'danger'` — alert-bundle tinted border, for irreversible actions needing caution.
   * - `'danger-filled'` — solid rose, for confirmed destructive actions.
   * - `'ghost'` — bordered with muted text, for secondary/cancel actions.
   * - `'elevated'` — surface background, used for the floating action buttons in `LinksToolbar`.
   */
  variant?: 'default' | 'danger' | 'danger-filled' | 'ghost' | 'elevated';
  ref?: Ref<HTMLButtonElement>;
}

const SMALL_PADDING = 'px-3 py-1.5';

const variantClasses: Record<
  NonNullable<IconButtonProps['variant']>,
  string
> = {
  default: `${SMALL_PADDING} hover:bg-[var(--bg-elevated)] disabled:bg-inherit ring-1 ring-[var(--border)] text-[var(--text)] ${FOCUS_RING} disabled:active:scale-100`,
  danger: `${SMALL_PADDING} hover:bg-[var(--alert-bg)] ring-1 ring-[var(--alert-border)] text-[var(--alert-text)] [[data-theme='nouvelle-vague']_&]:hover:bg-[var(--bg-elevated)] [[data-theme='nouvelle-vague']_&]:ring-[var(--border)] [[data-theme='nouvelle-vague']_&]:text-[var(--text)] [[data-theme='nouvelle-vague'][data-mode='dark']_&]:hover:bg-[var(--bg-elevated)] [[data-theme='nouvelle-vague'][data-mode='dark']_&]:ring-[var(--border)] [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-[var(--text)] [[data-theme='nouvelle-vague']_&]:focus-visible:ring-[var(--accent)] ${FOCUS_RING_DANGER}`,
  // `danger-filled` keeps the legacy Tailwind rose-600 saturation until the
  // bundle architecture adds a `--{bundle}-highlight-fg` foreground slot
  // across all state bundles. Today the only candidate foreground (`--alert-bg`)
  // is alpha-on-page in dark mode and cannot guarantee a deterministic
  // contrast ratio against `--alert-highlight`. Deferral, not omission.
  'danger-filled': `${SMALL_PADDING} bg-rose-600 hover:bg-rose-500 ring-1 ring-rose-600 hover:ring-rose-500 text-rose-50 [[data-theme='nouvelle-vague']_&]:bg-[var(--accent)] [[data-theme='nouvelle-vague']_&]:hover:bg-[var(--accent-hover)] [[data-theme='nouvelle-vague']_&]:ring-[var(--accent)] [[data-theme='nouvelle-vague']_&]:hover:ring-[var(--accent-hover)] [[data-theme='nouvelle-vague']_&]:text-[var(--accent-fg)] [[data-theme='nouvelle-vague']_&]:focus-visible:ring-[var(--accent)] ${FOCUS_RING_DANGER}`,
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

  // Skip DISABLED when hidden: `disabled:opacity-60` has higher CSS specificity
  // than `opacity-0` and would render hidden buttons at 60% opacity instead of invisible.
  const disabledClasses = hidden ? '' : DISABLED;

  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 text-xs rounded-full cursor-pointer ${disabledClasses} active:scale-[0.96] transition duration-200 ${variantClasses[variant]} ${visibilityClasses} ${className}`}
      type="button"
      // GOTCHA: `disabled` + `aria-hidden` together give complete AT isolation:
      // `disabled` removes the button from the tab order and interactive AT tree;
      // `aria-hidden` seals browse-mode traversal (e.g. NVDA arrow keys) so screen
      // readers don't announce the invisible button's text. `aria-hidden` is safe
      // here because `disabled` already makes the element non-focusable.
      disabled={hidden || disabled}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
