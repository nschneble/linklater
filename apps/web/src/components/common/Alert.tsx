import type { ReactNode, Ref } from 'react';

/**
 * Inline alert banner used for form-level error and success messages.
 *
 * Renders a `<p>` element. The `role` attribute is set automatically:
 * `'alert'` for errors (announced immediately by screen readers) and
 * `'status'` for success (polite announcement).
 *
 * Always renders a variant-specific icon for color-independent meaning.
 * The `icon` prop overrides the default icon when provided.
 *
 * Use directly below the field or form section it relates to.
 */
interface AlertProps {
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
  /** Forwarded to the underlying `<p>` so callers can `.focus()` the alert. */
  ref?: Ref<HTMLParagraphElement>;
  /**
   * When set, makes the alert programmatically focusable so callers can
   * `.focus()` it on appearance — needed when a sibling button keeps focus
   * and a focused element's own re-render is not reliably re-announced.
   */
  tabIndex?: number;
  variant: 'error' | 'success';
}

const defaultIcons: Record<AlertProps['variant'], string> = {
  error: 'fa-circle-exclamation',
  success: 'fa-circle-check',
};

// All themes route through the alert/success color bundles (see
// `theme/styles/bundles.css`). Per-theme overrides previously lived here as
// inline Tailwind branches; now every theme — including Nouvelle Vague's
// grayscale-by-design palette — defines its own bundle cascade.
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
  children,
  className = '',
  icon,
  id,
  ref,
  tabIndex,
  variant,
}: AlertProps) {
  // When no content is provided, keep the element in the DOM so any
  // `aria-describedby` pointing at `id` is never a dangling reference, but
  // hide it visually and from assistive technology.
  if (!children) {
    return <p id={id} aria-hidden="true" className="sr-only" />;
  }

  const resolvedIcon = icon ?? defaultIcons[variant];

  return (
    <p
      id={id}
      ref={ref}
      tabIndex={tabIndex}
      className={`px-3 py-2 border text-xs rounded-lg flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${variantClasses[variant]} ${className}`}
      role={variantRoles[variant]}
    >
      <i className={`fa-solid ${resolvedIcon} text-xs`} aria-hidden="true" />
      {children}
    </p>
  );
}
