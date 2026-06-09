import type { CSSProperties } from 'react';

/**
 * Shared Tailwind CSS class strings for interactive element focus rings.
 * Consuming components spread this into their `className` prop so that
 * the focus style is consistent across the whole application.
 *
 * Uses `focus-visible` (not `focus`) so that the ring only appears during
 * keyboard navigation, not on mouse clicks.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]';

/**
 * Shared Tailwind CSS class string for disabled button states.
 * Applied to `PrimaryButton` and `IconButton` so that any disabled button
 * consistently reduces opacity and shows a wait cursor.
 */
export const DISABLED = 'disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * Variant of `FOCUS_RING` for destructive actions. Maps to the alert bundle's
 * highlight slot so the ring tracks per-theme palettes alongside the rest of
 * the alert surface.
 */
export const FOCUS_RING_DANGER =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--alert-highlight)]';

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
