import type { CSSProperties } from 'react';

/**
 * Shared Tailwind CSS class strings for interactive element focus rings.
 * Consuming components spread this into their `className` prop so that
 * the focus style is consistent across the whole application.
 *
 * Uses `focus-visible` (not `focus`) so that the ring only appears during
 * keyboard navigation, not on mouse clicks.
 *
 * `forced-colors:focus-visible:outline-*` is the Windows High Contrast
 * Mode fallback: HCM strips background colors (including the ring), so we
 * paint a system-color outline as a second-channel focus indicator. Keeps
 * SC 2.4.7 intact for HCM keyboard users.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText]';

/**
 * Shared Tailwind CSS class string for disabled button states.
 * Applied to `PrimaryButton` and `IconButton`.
 */
export const DISABLED = 'disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * Variant of `FOCUS_RING` for destructive actions that paint on the host
 * bundle bg (not the alert-highlight fill). Maps to the alert bundle's
 * highlight slot so the ring tracks per-theme palettes alongside the rest
 * of the alert surface. Safe wherever the button bg is NOT
 * `--alert-highlight`; for solid-alert-highlight fills, use
 * `FOCUS_RING_DANGER_FILLED` instead.
 */
export const FOCUS_RING_DANGER =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--alert-highlight)] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText]';

/**
 * Variant of `FOCUS_RING_DANGER` for destructive buttons whose fill IS
 * `--alert-highlight`. Recovery Option A, Toast precedent: an
 * `--alert-highlight` ring against an `--alert-highlight` background
 * paints 1:1 invisible, breaking SC 1.4.11 + 2.4.7. The highlight-fg
 * slot inherits a 4.5:1 floor against highlight from the bundle contract
 * (see `bundles.contrast.test.ts` `highlight-fg/highlight` pair), so the
 * ring is comfortably visible by construction regardless of per-theme
 * variance.
 */
export const FOCUS_RING_DANGER_FILLED =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--alert-highlight-fg)] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText]';

/**
 * Inline style object for an animated menu/panel reveal.
 *
 * Animates opacity and transform together. The open state uses a slower
 * ease-out; the close state uses a faster ease-in so the panel feels snappy.
 *
 * @param isOpen - Whether the menu is currently open.
 * @param openTransform - CSS transform value when open (default: `'scale(1)'`).
 * @param closedTransform - CSS transform value when closed (default: `'scale(0.95)'`).
 */
export function menuRevealStyle(
  isOpen: boolean,
  openTransform = 'scale(1)',
  closedTransform = 'scale(0.95)',
): CSSProperties {
  return {
    transition: `opacity ${isOpen ? '150ms ease-out' : '100ms ease-in'}, transform ${isOpen ? '150ms ease-out' : '100ms ease-in'}`,
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? openTransform : closedTransform,
  };
}
