import type { ButtonHTMLAttributes } from 'react';
import { DISABLED, FOCUS_RING } from '../../lib/styles';

/**
 * Accent-colored primary action button used for the main call-to-action in
 * forms and toolbars (e.g. "Save link", "Log in", "Create account").
 *
 * Defaults to `type="submit"` so it can be dropped inside a `<form>` without
 * extra wiring. Pass `type="button"` when using outside a form.
 *
 * When `hidden` is `true` the button fades out and becomes non-interactive
 * while still occupying layout space — same pattern as `IconButton`.
 *
 * Accepts all native `<button>` attributes.
 */
interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * When `true`, the button is invisible and non-interactive but still occupies
   * layout space. Keeps toolbar layouts stable when controls are conditionally shown.
   *
   * @default false
   */
  hidden?: boolean;
}

export default function PrimaryButton({
  children,
  className = '',
  disabled,
  hidden = false,
  type = 'submit',
  ...props
}: PrimaryButtonProps) {
  const visibilityClasses = hidden
    ? 'opacity-0 scale-95 pointer-events-none'
    : 'opacity-100 scale-100';

  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 pl-3.5 pr-4 py-2 bg-[var(--accent)] disabled:bg-[var(--accent)] hover:bg-[var(--accent-hover)] border-shadow hover:border-shadow text-[var(--accent-fg)] text-xs font-semibold ${FOCUS_RING} rounded-full cursor-pointer ${DISABLED} transition duration-200 active:scale-[0.96] disabled:active:scale-100 ${visibilityClasses} ${className}`}
      type={type}
      disabled={hidden || disabled}
      tabIndex={hidden ? -1 : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
