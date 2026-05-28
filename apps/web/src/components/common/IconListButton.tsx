import type { ButtonHTMLAttributes } from 'react';
import { DISABLED, FOCUS_RING } from '../../lib/styles';

/**
 * Full-width row button used for vertical lists (e.g. the Settings sidebar).
 * Mirrors the structure of `IconButton` but uses a left-aligned row layout
 * with the icon leading the label rather than the pill/inline-flex layout.
 *
 * Active state is driven by `aria-current` (set by the parent — typically to
 * `"page"`) and styled via Tailwind `aria-[current]:` variants, so the ARIA
 * attribute and the visual state stay locked together and cannot drift.
 *
 * When `hidden` is `true` the button fades out and becomes non-interactive
 * (`pointer-events-none`, `tabIndex={-1}`). Same pattern as `IconButton`.
 *
 * Accepts all native `<button>` attributes so `onClick`, `disabled`, `aria-*`,
 * etc. are passed through.
 */
interface IconListButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Optional Font Awesome icon class (e.g. `'fa-user'`). When provided, an
   * `aria-hidden` decorative `<i>` is rendered before the label.
   */
  icon?: string;
  /**
   * When `true`, the button is invisible and non-interactive but still occupies
   * layout space. Useful for conditionally showing controls without reflow.
   *
   * @default false
   */
  hidden?: boolean;
}

export default function IconListButton({
  className = '',
  children,
  disabled,
  hidden = false,
  icon,
  ...properties
}: IconListButtonProps) {
  const visibilityClasses = hidden
    ? 'opacity-0 scale-95 pointer-events-none'
    : 'opacity-100 scale-100';

  // Skip DISABLED when hidden: `disabled:opacity-60` has higher CSS specificity
  // than `opacity-0` and would render hidden buttons at 60% opacity instead of
  // invisible.
  const disabledClasses = hidden ? '' : DISABLED;

  return (
    <button
      className={`group flex items-center gap-2.5 w-full min-h-10 px-3 py-2 hover:bg-[var(--bg-surface)] aria-[current]:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text)] aria-[current]:text-[var(--text)] text-sm font-medium aria-[current]:font-semibold ${FOCUS_RING} rounded-lg motion-safe:active:scale-[0.96] motion-safe:[transition:background-color_150ms,color_150ms,scale_150ms] cursor-pointer ${disabledClasses} ${visibilityClasses} ${className}`}
      type="button"
      // GOTCHA: `disabled` + `aria-hidden` together give complete AT isolation:
      // `disabled` removes the button from the tab order and interactive AT tree;
      // `aria-hidden` seals browse-mode traversal so screen readers don't
      // announce the invisible button's text. `aria-hidden` is safe here because
      // `disabled` already makes the element non-focusable.
      disabled={hidden || disabled}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      {...properties}
    >
      {icon && (
        <i
          className={`fa-solid ${icon} text-[var(--text-subtle)] group-aria-[current]:text-[var(--accent)] text-xs`}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
