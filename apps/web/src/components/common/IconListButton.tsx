import { DISABLED, FOCUS_RING } from '../../lib/styles';
import type { ButtonHTMLAttributes } from 'react';

/**
 * Full-width row button for vertical lists (e.g. the Settings sidebar).
 *
 * Active state is driven by `aria-current` (set by the parent – typically to
 * `"page"`) and styled via Tailwind `aria-[current]:` variants, so the ARIA
 * attribute and the visual state stay locked together and cannot drift.
 *
 * When `hidden` is `true` the button fades out and becomes non-interactive
 * (`pointer-events-none`, `tabIndex={-1}`). Same pattern as `IconButton`.
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

  const disabledClasses = hidden ? '' : DISABLED;

  return (
    <button
      className={`group flex items-center gap-2.5 w-full min-h-10 px-3 py-2 hover:bg-[var(--mount-bg)] aria-[current]:bg-[var(--orbit-bg)] aria-[current]:ring-1 aria-[current]:ring-[var(--orbit-border)] text-[var(--base-alt-text)] hover:text-[var(--base-text)] aria-[current]:text-[var(--orbit-text)] text-sm font-medium aria-[current]:font-semibold ${FOCUS_RING} rounded-lg motion-safe:active:scale-[0.96] motion-safe:[transition:background-color_150ms,color_150ms,scale_150ms] cursor-pointer ${disabledClasses} ${visibilityClasses} ${className}`}
      type="button"
      // disabled + aria-hidden hide from AT; disabled already blocks focus
      disabled={hidden || disabled}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      {...properties}
    >
      {icon && (
        <i
          className={`fa-solid ${icon} text-[var(--base-subtle-text)] group-aria-[current]:text-[var(--orbit-highlight)] text-xs`}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
