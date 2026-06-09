import type { ReactNode } from 'react';

interface SettingsGroupProps {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  variant?: 'default' | 'danger';
  /**
   * The id of the section currently active in the scroll-spy. When it equals
   * this group's `id`, the group renders a persistent ring so the connection
   * between the sidebar's active item and the page is unambiguous.
   */
  activeSection?: string;
  children: ReactNode;
}

// The `danger` variant routes through the `alert` bundle (see
// `theme/styles/bundles.css`). Every theme — including Nouvelle Vague's
// grayscale-by-design palette — defines its own bundle cascade.
const VARIANT_CLASSES = {
  default: 'bg-[var(--mount-bg)] border border-[var(--mount-border)]',
  danger: 'bg-[var(--alert-bg)] border border-[var(--alert-border)]',
} as const;

const HEADING_CLASSES = {
  default: 'text-[var(--mount-text)]',
  danger: 'text-[var(--alert-text)]',
} as const;

// Mount has no subtle-text slot; icons fall back to the alt-text tier.
const ICON_CLASSES = {
  default: 'text-[var(--mount-alt-text)]',
  danger: 'text-[var(--alert-highlight)]',
} as const;

const DESCRIPTION_CLASSES = {
  default: 'text-[var(--mount-alt-text)]',
  danger: 'text-[var(--alert-alt-text)]',
} as const;

/**
 * Card wrapper for a settings group. Owns the heading, optional description,
 * card chrome, and the focus target for hash-based deep-linking. Subsections
 * render unboxed inside.
 *
 * The `id` doubles as the URL section target. `tabIndex={-1}` lets the
 * SettingsView scroll effect move focus here so screen-reader users land on
 * the group when they follow a deep link.
 *
 * When `activeSection === id`, the card gains a 3px accent `outline` plus an
 * accent border color. The outline renders just outside the border edge,
 * against the page background `--bg` — the highest-contrast pairing for
 * `--accent` across every theme. (An accent indicator on the card surface
 * fails WCAG 1.4.11 in dark themes where `--accent` and `--bg-surface` are
 * close in luminance.) At 3px the indicator clears the WCAG non-text
 * "thick line" consideration, and its presence/absence — not just its hue —
 * signals the active state, satisfying 1.4.1 (use of color). It is driven off
 * the `data-active` attribute via a Tailwind `data-[active=true]:` variant so
 * visual and data state stay locked together.
 *
 * The active `outline` and the keyboard focus `ring-2` live on different
 * layers and never merge: `focus-visible:outline-none` drops the active
 * outline exactly when the focus ring renders (same `:focus-visible`
 * modality), so there is never a frame showing neither indicator; the active
 * outline returns once focus leaves. A `forced-colors` companion maps the
 * active outline to `Highlight` and the focus outline to `ButtonText` for
 * Windows High Contrast Mode, where box-shadow rings are ignored.
 */
export default function SettingsGroup({
  id,
  title,
  description,
  icon,
  variant = 'default',
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
      className={`relative scroll-mt-[111px] p-5 sm:p-6 ${VARIANT_CLASSES[variant]} data-[active=true]:border-[var(--accent)] data-[active=true]:outline data-[active=true]:outline-[3px] data-[active=true]:outline-[var(--accent)] forced-colors:data-[active=true]:outline-[Highlight] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText] rounded-2xl motion-safe:transition-[border-color,outline-color]`}
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
      {children}
    </section>
  );
}
