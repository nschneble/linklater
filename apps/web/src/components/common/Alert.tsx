import { useThemeStyling } from '../../theme/ThemeContext';
import { resolveThemeClasses, type ThemeClassMap } from '../../lib/styles';
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

const variantClasses: Record<AlertProps['variant'], ThemeClassMap> = {
  error: {
    dark: {
      default: 'bg-rose-950/40 border-rose-800 text-rose-400',
      'apollo-10-1-2':
        'bg-[var(--state-danger)]/15 border-l-4 border-[var(--state-danger)] text-[var(--state-danger-fg)]',
      'nouvelle-vague': 'bg-gray-900/40 border-gray-700 text-gray-400',
    },
    light: {
      default: 'bg-rose-50 border-rose-200 text-rose-700',
      'apollo-10-1-2':
        'bg-[var(--state-danger)]/15 border-l-4 border-[var(--state-danger)] text-[#9a3447]',
      'nouvelle-vague': 'bg-gray-100 border-gray-300 text-gray-700',
    },
  },
  success: {
    dark: {
      default: 'bg-emerald-950/40 border-emerald-700 text-emerald-300',
      'apollo-10-1-2':
        'bg-[var(--state-success)]/15 border-l-4 border-[var(--accent)] text-[var(--accent)]',
      'nouvelle-vague': 'bg-gray-900/40 border-gray-700 text-gray-400',
    },
    light: {
      default: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      'apollo-10-1-2':
        'bg-[var(--state-success)]/15 border-l-4 border-[var(--accent)] text-[var(--accent)]',
      'nouvelle-vague': 'bg-gray-100 border-gray-300 text-gray-600',
    },
  },
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
  const { baseTheme, mode } = useThemeStyling();

  const resolvedIcon = icon ?? defaultIcons[variant];
  const resolvedClasses = resolveThemeClasses(
    variantClasses[variant],
    mode,
    baseTheme,
  );

  return (
    <p
      id={id}
      ref={ref}
      tabIndex={tabIndex}
      className={`px-3 py-2 border text-xs rounded-lg flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${resolvedClasses} ${className}`}
      role={variantRoles[variant]}
    >
      <i className={`fa-solid ${resolvedIcon} text-xs`} aria-hidden="true" />
      {children}
    </p>
  );
}
