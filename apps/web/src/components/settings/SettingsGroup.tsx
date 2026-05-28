import type { ReactNode } from 'react';

interface SettingsGroupProps {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  variant?: 'default' | 'danger';
  divided?: boolean;
  /**
   * The id of the section currently active in the scroll-spy. When it equals
   * this group's `id`, the group renders a persistent ring so the connection
   * between the sidebar's active item and the page is unambiguous.
   */
  activeSection?: string;
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
 * The `id` doubles as the URL section target. `tabIndex={-1}` lets the
 * SettingsView scroll effect move focus here so screen-reader users land on
 * the group when they follow a deep link.
 *
 * When `activeSection === id`, an accent bar appears in the gutter at the
 * group's left edge (a `::before` pseudo-element translated fully into the
 * gap so it sits against the page background `--bg`, not the card surface).
 * The page background is the highest-contrast pairing for `--accent` across
 * every theme — an accent ring on the card surface failed WCAG 1.4.11 in
 * most dark themes because `--accent` and `--bg-surface` are too close in
 * luminance. The bar is driven off the `data-active` attribute via a Tailwind
 * `data-[active=true]:` variant so visual and data state stay locked together,
 * and is kept visually distinct from the keyboard focus ring (`ring-2` full
 * accent). A `forced-colors` companion swaps the bar to `Highlight` (and the
 * focus ring to a `ButtonText` outline) for Windows High Contrast Mode, where
 * box-shadow-based rings are ignored. The fade-in is gated behind
 * `motion-safe` so reduced-motion users get an unanimated state change.
 */
export default function SettingsGroup({
  id,
  title,
  description,
  icon,
  variant = 'default',
  divided = false,
  activeSection,
  children,
}: SettingsGroupProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={headingId}
      data-active={activeSection === id}
      className={`relative scroll-mt-24 p-5 sm:p-6 ${VARIANT_CLASSES[variant]} focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText] rounded-2xl before:absolute before:left-0 before:inset-y-5 before:w-1 before:-translate-x-full before:bg-[var(--accent)] before:rounded-full before:opacity-0 before:content-[''] data-[active=true]:before:opacity-100 forced-colors:before:bg-[Highlight] motion-safe:before:transition-opacity`}
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
