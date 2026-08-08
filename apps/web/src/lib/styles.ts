import type { CSSProperties } from 'react';

// the forced-colors outline is the Windows High Contrast fallback: that
// mode drops the ring's background color, so the outline has to carry the
// focus indicator on its own
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText]';

export const DISABLED = 'disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * For destructive buttons drawn on their host surface. Use
 * `FOCUS_RING_DANGER_FILLED` when the alert highlight is the button fill.
 */
export const FOCUS_RING_DANGER =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--alert-highlight)] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText]';

/**
 * For destructive buttons filled with the alert highlight, where a ring in
 * that same color would paint invisible. Uses the highlight foreground,
 * which the bundle contract already floors at 4.5:1 against that fill.
 */
export const FOCUS_RING_DANGER_FILLED =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--alert-highlight-fg)] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText]';

// closing runs faster than opening so the panel feels snappy
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
