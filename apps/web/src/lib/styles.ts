import type { CSSProperties } from 'react';

/**
 * The focus indicator for a control with no visible edge of its own.
 *
 * `outline` rather than `ring`, because a ring is a box-shadow and loses to
 * any elevation shadow on the same element.
 *
 * The offset is not a contrast decision. Only the band's OUTER edge is the
 * adjacency SC 1.4.11 measures, and that edge sits on the host surface at
 * any offset — a surface the bundle contract already pins `--focus-ring`
 * against. What the offset buys is perceptibility on a filled control:
 * `--focus-ring` and `--{surface}-highlight` are the same colour in eleven
 * of the twenty theme cascades, so a band touching such a fill just makes
 * the control look bigger. That is also why there is no destructive
 * variant — the red-on-red pairing cannot arise across a gap.
 */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] forced-colors:focus-visible:outline-[Highlight]';

/**
 * The same indicator, sat against the control's own edge.
 *
 * For a control that already draws a visible static boundary at its border
 * box — a `border`, or a `ring-1` in a colour other than its fill — where
 * the band reads as that edge thickening rather than as a second rectangle
 * outside it. A control with nothing there takes `FOCUS_RING` instead, and
 * so does one where something else already occupies the flush position:
 * `SettingsGroup` marks its active section with an outline there, and in
 * the eleven cascades where `--focus-ring` equals `--base-highlight` a
 * flush focus band would render that card pixel-identical to its unfocused
 * active state.
 *
 * Erasing the border underneath is a SEPARATE decision, spelled out at the
 * one or two call sites that want it. Bundling it here hid it from the
 * controls whose border carries state and would have blanked that state.
 *
 * Written out rather than derived from `FOCUS_RING`, because Tailwind scans
 * source text: a class assembled at runtime is a class it never compiles.
 */
export const FOCUS_RING_FLUSH =
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)] forced-colors:focus-visible:outline-[Highlight]';

export const DISABLED = 'disabled:opacity-60 disabled:cursor-not-allowed';

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
