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
