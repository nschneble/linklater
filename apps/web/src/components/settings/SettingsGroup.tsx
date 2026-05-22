import type { ReactNode } from 'react';

interface SettingsGroupProps {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  variant?: 'default' | 'danger';
  divided?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES = {
  default:
    "bg-[var(--bg-surface)] border border-[var(--border)] [[data-theme='nouvelle-vague']_&]:bg-gray-50 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:bg-gray-900/20",
  danger:
    "bg-rose-50 [[data-mode='dark']_&]:bg-rose-950/20 [[data-theme='nouvelle-vague']_&]:bg-gray-100 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:bg-gray-900/20 border border-rose-200 [[data-mode='dark']_&]:border-rose-800/50 [[data-theme='nouvelle-vague']_&]:border-gray-300 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:border-gray-700/50",
} as const;

const HEADING_CLASSES = {
  default: 'text-[var(--text)]',
  danger:
    "text-rose-700 [[data-mode='dark']_&]:text-rose-400 [[data-theme='nouvelle-vague']_&]:text-gray-700 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-gray-400",
} as const;

const ICON_CLASSES = {
  default: 'text-[var(--text-subtle)]',
  danger:
    "text-rose-500 [[data-mode='dark']_&]:text-rose-400 [[data-theme='nouvelle-vague']_&]:text-gray-500 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-gray-500",
} as const;

const DESCRIPTION_CLASSES = {
  default: 'text-[var(--text-muted)]',
  danger:
    "text-rose-600/80 [[data-mode='dark']_&]:text-rose-300/80 [[data-theme='nouvelle-vague']_&]:text-gray-600/80 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-gray-400/80",
} as const;

/**
 * Card wrapper for a settings group. Owns the heading, optional description,
 * card chrome, and the focus target for hash-based deep-linking. Subsections
 * render unboxed inside; pass `divided` when the group holds multiple
 * subsections and they should be visually separated by a thin rule.
 *
 * The `id` doubles as the URL hash target. `tabIndex={-1}` lets the
 * SettingsView hash-scroll effect move focus here so screen-reader users
 * land on the group when they follow a deep link.
 */
export default function SettingsGroup({
  id,
  title,
  description,
  icon,
  variant = 'default',
  divided = false,
  children,
}: SettingsGroupProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={`scroll-mt-24 p-5 sm:p-6 ${VARIANT_CLASSES[variant]} rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
    >
      <header className={description ? 'mb-5' : 'mb-4'}>
        <h2
          id={headingId}
          className={`flex items-center gap-2 ${HEADING_CLASSES[variant]} text-lg font-semibold text-balance`}
        >
          {icon && (
            <i
              className={`fa-solid ${icon} ${ICON_CLASSES[variant]} text-sm`}
              aria-hidden="true"
            />
          )}
          {title}
        </h2>
        {description && (
          <p
            className={`mt-1 ${DESCRIPTION_CLASSES[variant]} text-sm text-pretty`}
          >
            {description}
          </p>
        )}
      </header>
      <div
        className={
          divided
            ? 'divide-y divide-[var(--border)] [&>*+*]:pt-6 [&>*+*]:mt-6'
            : ''
        }
      >
        {children}
      </div>
    </section>
  );
}
