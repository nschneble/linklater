import type { ButtonHTMLAttributes, Ref } from 'react';
import { DISABLED, FOCUS_RING } from '../../lib/styles';

/**
 * Primary call-to-action button. Defaults to `type="submit"` so it can be
 * dropped inside a `<form>` without extra wiring; pass `type="button"` when
 * using outside a form.
 *
 * When `hidden` is `true` the button fades out and becomes non-interactive
 * while still occupying layout space — same pattern as `IconButton`.
 */
interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * When `true`, the button is invisible and non-interactive but still occupies
   * layout space. Keeps toolbar layouts stable when controls are conditionally shown.
   */
  hidden?: boolean;
  ref?: Ref<HTMLButtonElement>;
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

  // Skip DISABLED when hidden — see IconButton for the full rationale.
  const disabledClasses = hidden ? '' : DISABLED;

  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 pl-3.5 pr-4 py-2 bg-[var(--accent)] disabled:bg-[var(--accent)] hover:bg-[var(--accent-hover)] border-shadow hover:border-shadow text-[var(--accent-fg)] text-xs font-semibold ${FOCUS_RING} rounded-full ${disabledClasses} transition duration-200 active:scale-[0.96] disabled:active:scale-100 cursor-pointer ${visibilityClasses} ${className}`}
      type={type}
      // GOTCHA: same disabled + aria-hidden pattern as IconButton — see that file for rationale.
      disabled={hidden || disabled}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
