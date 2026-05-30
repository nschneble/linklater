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
      default: 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400',
      'nouvelle-vague':
        'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)] font-medium',
      'apollo-10-1-2':
        'bg-[var(--state-success)]/15 border-[1.5px] border-[var(--state-success)] text-[var(--state-success-fg)]',
    },
    light: {
      default: 'bg-emerald-100 border-emerald-300 text-emerald-700',
      'nouvelle-vague':
        'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)] font-medium',
      'apollo-10-1-2':
        'bg-[var(--state-success)]/15 border-[1.5px] border-[var(--state-success)] text-[var(--state-success-fg)]',
    },
  },
  warning: {
    dark: {
      default: 'bg-amber-950/20 border-amber-800/40 text-amber-300',
      'nouvelle-vague':
        'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]',
      'apollo-10-1-2':
        'bg-[var(--state-warning)]/15 border-[1.5px] border-[var(--state-warning)] text-[var(--state-warning)]',
    },
    light: {
      default: 'bg-amber-100 border-amber-300 text-amber-700',
      'nouvelle-vague':
        'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]',
      'apollo-10-1-2':
        'bg-[var(--state-warning)]/15 border-[1.5px] border-[var(--state-warning)] text-[var(--state-warning)]',
    },
  },
  info: {
    dark: {
      default: 'bg-blue-950/20 border-blue-800/40 text-blue-400',
      'nouvelle-vague':
        'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]',
      'apollo-10-1-2':
        'bg-[var(--state-info)]/15 border-[1.5px] border-[var(--state-info)] text-[var(--state-info-fg)]',
    },
    light: {
      default: 'bg-blue-100 border-blue-300 text-blue-700',
      'nouvelle-vague':
        'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]',
      'apollo-10-1-2':
        'bg-[var(--state-info)]/15 border-[1.5px] border-[var(--state-info)] text-[var(--state-info-fg)]',
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
