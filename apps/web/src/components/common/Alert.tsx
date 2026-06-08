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

// The `default` branch routes through the alert/success color bundles
// (see `theme/styles/bundles.css`). Themes that have not been migrated to
// per-theme bundle palettes fall through to the default bundle values,
// which mirror the previous rose / emerald inline hues. Nouvelle Vague
// keeps its bespoke grayscale override — the whole theme is grayscale by
// design. Apollo's wave-8 migration moved its CVD-tuned palette into the
// bundle cascade, so it falls through the default branch like every other
// migrated theme.
const variantClasses: Record<AlertProps['variant'], ThemeClassMap> = {
  error: {
    dark: {
      default:
        'bg-[var(--alert-bg)] border-[var(--alert-border)] text-[var(--alert-text)]',
      'nouvelle-vague': 'bg-gray-900/40 border-gray-700 text-gray-400',
    },
    light: {
      default:
        'bg-[var(--alert-bg)] border-[var(--alert-border)] text-[var(--alert-text)]',
      'nouvelle-vague': 'bg-gray-100 border-gray-300 text-gray-700',
    },
  },
  success: {
    dark: {
      default:
        'bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success-text)]',
      'nouvelle-vague': 'bg-gray-900/40 border-gray-700 text-gray-400',
    },
    light: {
      default:
        'bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success-text)]',
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

  // When no content is provided, keep the element in the DOM so any
  // `aria-describedby` pointing at `id` is never a dangling reference, but
  // hide it visually and from assistive technology.
  if (!children) {
    return <p id={id} aria-hidden="true" className="sr-only" />;
  }

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
      className={`px-3 py-2 border text-xs rounded-lg flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${resolvedClasses} ${className}`}
      role={variantRoles[variant]}
    >
      <i className={`fa-solid ${resolvedIcon} text-xs`} aria-hidden="true" />
      {children}
    </p>
  );
}
