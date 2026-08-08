import type { ReactNode, Ref } from 'react';

/**
 * Inline alert banner used for form-level error and success messages.
 *
 * Renders a `<p>` element. The `role` attribute is set automatically:
 * `'alert'` for errors (announced immediately by screen readers) and
 * `'status'` for success (polite announcement), unless `announce` is
 * `false`, which leaves the alert visual-only.
 *
 * Always renders a variant-specific icon for color-independent meaning.
 * The `icon` prop overrides the default icon when provided.
 *
 * Use directly below the field or form section it relates to.
 */
interface AlertProps {
  /**
   * When `true` (default) the alert owns a live region and announces itself
   * on the empty → populated transition. Set `false` when the caller already
   * announces the same message through a separate always-mounted region, so
   * the two don't race the screen reader with one message.
   */
  announce?: boolean;
  children: ReactNode;
  className?: string;
  /**
   * Font Awesome icon class to render before the children (without `fa-solid`
   * prefix, e.g. `'fa-triangle-exclamation'`). Overrides the default variant
   * icon when provided.
   */
  icon?: string;
  /** Stable `id` so inputs can reference this alert via `aria-describedby`. */
  id?: string;
  /**
   * When `true`, marks the rendered `<p>` inert (non-interactive and hidden
   * from assistive tech). Used by callers that live behind a modal dialog so
   * the alert is excluded from the background while the dialog is open.
   */
  inert?: boolean;
  /** Forwarded to the underlying `<p>` so callers can `.focus()` the alert. */
  ref?: Ref<HTMLParagraphElement>;
  /**
   * When set, makes the alert programmatically focusable so callers can
   * `.focus()` it on appearance – needed when a sibling button keeps focus
   * and a focused element's own re-render is not reliably re-announced.
   */
  tabIndex?: number;
  variant: 'error' | 'success';
}

const defaultIcons: Record<AlertProps['variant'], string> = {
  error: 'fa-circle-exclamation',
  success: 'fa-circle-check',
};

// variants read alert/success bundle tokens; each theme owns its cascade
const variantClasses: Record<AlertProps['variant'], string> = {
  error:
    'bg-[var(--alert-bg)] border-[var(--alert-border)] text-[var(--alert-text)]',
  success:
    'bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success-text)]',
};

const variantRoles: Record<AlertProps['variant'], string> = {
  error: 'alert',
  success: 'status',
};

export default function Alert({
  announce = true,
  children,
  className = '',
  icon,
  id,
  inert,
  ref,
  tabIndex,
  variant,
}: AlertProps) {
  // keep an empty node in the DOM so aria-describedby to id never dangles
  if (!children) {
    return <p id={id} inert={inert} aria-hidden="true" className="sr-only" />;
  }

  const resolvedIcon = icon ?? defaultIcons[variant];

  // announce=false: the caller owns the live region, so no role here
  let role: string | undefined;
  if (announce) role = variantRoles[variant];

  return (
    <p
      id={id}
      ref={ref}
      inert={inert}
      tabIndex={tabIndex}
      className={`px-3 py-2 border text-xs rounded-lg flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${variantClasses[variant]} ${className}`}
      role={role}
    >
      <i className={`fa-solid ${resolvedIcon} text-xs`} aria-hidden="true" />
      {children}
    </p>
  );
}
