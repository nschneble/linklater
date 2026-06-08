import { useThemeStyling } from '../../theme/ThemeContext';
import { resolveThemeClasses, type ThemeClassMap } from '../../lib/styles';
import type { ReactNode } from 'react';

interface StatusBadgeProps {
  /**
   * `'success'` renders a green pill (e.g. Verified, Connected, Enabled),
   * `'warning'` renders an amber pill (e.g. Unverified), `'info'` renders
   * a blue pill (e.g. Recommended).
   */
  variant: 'success' | 'warning' | 'info';
  /** Optional Font Awesome icon class (e.g. `'fa-solid fa-circle-check'`). */
  icon?: string;
  /** Visible label text. */
  children: ReactNode;
}

const defaultIcons: Record<StatusBadgeProps['variant'], string> = {
  success: 'fa-solid fa-circle-check',
  warning: 'fa-solid fa-triangle-exclamation',
  info: 'fa-solid fa-circle-info',
};

const variantShape: Record<StatusBadgeProps['variant'], string> = {
  success: 'rounded-full',
  warning: 'rounded',
  info: 'rounded-sm',
};

const variantClasses: Record<StatusBadgeProps['variant'], ThemeClassMap> = {
  success: {
    dark: {
      default:
        'bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success-text)]',
      'nouvelle-vague':
        'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)] font-medium',
    },
    light: {
      default:
        'bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success-text)]',
      'nouvelle-vague':
        'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)] font-medium',
    },
  },
  warning: {
    dark: {
      default:
        'bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--warn-text)]',
      'nouvelle-vague':
        'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]',
    },
    light: {
      default:
        'bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--warn-text)]',
      'nouvelle-vague':
        'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]',
    },
  },
  info: {
    dark: {
      default:
        'bg-[var(--info-bg)] border-[var(--info-border)] text-[var(--info-text)]',
      'nouvelle-vague':
        'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]',
    },
    light: {
      default:
        'bg-[var(--info-bg)] border-[var(--info-border)] text-[var(--info-text)]',
      'nouvelle-vague':
        'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]',
    },
  },
};

/**
 * Compact pill-shaped status indicator used next to labels in settings —
 * Verified/Unverified email, Connected social provider, Enabled MFA, etc.
 *
 * Always renders a variant-specific icon for color-independent meaning in
 * cvd-friendly contexts. The `icon` prop overrides the default when
 * provided. Every theme also gets a variant-specific pill shape
 * (`rounded-full` for success, `rounded` for warning, `rounded-sm` for info)
 * as an additional non-color distinguisher.
 */
export default function StatusBadge({
  variant,
  icon,
  children,
}: StatusBadgeProps) {
  const { baseTheme, mode } = useThemeStyling();

  const resolvedIcon = icon ?? defaultIcons[variant];
  const resolvedClasses = resolveThemeClasses(
    variantClasses[variant],
    mode,
    baseTheme,
  );

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 border text-xs ${resolvedClasses} ${variantShape[variant]}`}
    >
      <i className={`${resolvedIcon} text-[0.6rem]`} aria-hidden="true" />
      {children}
    </span>
  );
}
