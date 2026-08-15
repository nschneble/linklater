import { FOCUS_RING_FLUSH } from '../../lib/styles';
import type { ReactNode, Ref } from 'react';

interface AlertProps {
  /**
   * Set `false` when the caller already announces this message through a
   * separate always-mounted region, so the two do not race.
   */
  announce?: boolean;
  children: ReactNode;
  className?: string;
  /** Font Awesome icon name; this component adds the style prefix. */
  icon?: string;
  id?: string;
  /** Excludes the alert from the background behind an open dialog. */
  inert?: boolean;
  ref?: Ref<HTMLParagraphElement>;
  /**
   * Makes the alert focusable for callers whose sibling button keeps
   * focus: a focused element's own re-render is not reliably re-announced.
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

/**
 * Inline alert banner for form-level error and success messages. Paints a
 * variant icon alongside the color so meaning never rests on color alone.
 *
 * An empty message renders a bare node rather than nothing, which keeps a
 * caller's `aria-describedby` from dangling and keeps the live region in
 * the accessibility tree ahead of the text that fills it. A region born
 * populated in a single commit is the shape screen readers miss.
 */
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
  let role: string | undefined;
  if (announce) role = variantRoles[variant];

  // registered before it fills, or the first message goes unspoken
  if (!children) {
    return <p id={id} inert={inert} className="sr-only" role={role} />;
  }

  const resolvedIcon = icon ?? defaultIcons[variant];

  return (
    <p
      id={id}
      ref={ref}
      inert={inert}
      tabIndex={tabIndex}
      className={`px-3 py-2 border text-xs rounded-lg flex items-center justify-center gap-2 ${FOCUS_RING_FLUSH} ${variantClasses[variant]} ${className}`}
      role={role}
    >
      <i className={`fa-solid ${resolvedIcon} text-xs`} aria-hidden="true" />
      {children}
    </p>
  );
}
