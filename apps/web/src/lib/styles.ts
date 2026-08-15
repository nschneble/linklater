import type { CSSProperties } from 'react';

/**
 * The one focus indicator, for every control on every surface.
 *
 * `outline` rather than `ring`, because a ring is a box-shadow and loses to
 * any elevation shadow on the same element. The 2px offset is load-bearing:
 * it holds the band clear of the control's own fill so both its edges sit on
 * the host surface, which is where the bundle contract pins `--focus-ring`
 * at 3:1. Against a filled control the two are often the same color.
 *
 * That offset is also why there is no destructive variant. The pair that
 * justified one — a red ring vanishing into a red fill — cannot arise when
 * the band never touches the fill.
 */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] forced-colors:focus-visible:outline-[Highlight]';

/**
 * The same indicator, sat flush and taking the border's place.
 *
 * For text-entry inputs only, and only where two things hold: the fill is one
 * the bundle contract pins `--focus-ring` against, and the border carries no
 * state of its own, since this erases it. The hex row in the theme editor
 * fails the second test — its border turns alert-coloured on an invalid
 * value, exactly while the user is typing one.
 *
 * Written out rather than derived from `FOCUS_RING`, because Tailwind scans
 * source text: a class assembled at runtime is a class it never compiles.
 */
export const FOCUS_RING_FLUSH =
  'focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)] forced-colors:focus-visible:outline-[Highlight]';

export const DISABLED = 'disabled:cursor-not-allowed';

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
