import type { CSSProperties } from 'react';

/**
 * Fixed neutral palette for the Theme Editor's Randomize button — its guaranteed
 * escape hatch. Every other chrome control paints from the active theme's bundle
 * tokens, so a hostile or unreadable custom palette can degrade them. Randomize
 * spreads this instead so it stays readable on any palette: it is the recovery
 * control that stays operable when a hostile custom palette is live, since the
 * copy button HIDES once custom is on. Randomize must stay legible precisely
 * when the custom colors are broken.
 *
 * Opaque on purpose: a translucent fill would composite over the (possibly
 * unreadable) page background and lose its guaranteed contrast. The border
 * (#404040 on #fafafa) measures 9.93:1, clearing SC 1.4.11 with margin.
 */
export const ESCAPE_HATCH_LIGHT: CSSProperties = {
  backgroundColor: '#fafafa',
  color: '#0a0a0a',
  borderColor: '#404040',
};

/**
 * Fixed fill + label pair for the active pill of the editor's dark/light mode
 * toggle, keyed by the current mode. The toggle borrows the read/unread
 * sliding-pill LOOK but NOT its bundle tokens: those come from the untrusted
 * custom palette with no contrast guarantee (`bundles.contrast.test.ts` only
 * covers the film themes), so a hostile palette could collapse the active
 * label against its pill. The mode toggle is the very control needed to reach
 * the dark/light palettes being repaired, so it must stay legible regardless.
 *
 * Each pair is the inverse of the page background it sits over, so the pill
 * reads against the track (SC 1.4.11) and the label reads against the pill
 * (~19:1, SC 1.4.3): a near-white pill in dark mode, a near-black pill in
 * light mode. Not guarded by `bundles.contrast.test.ts` — these are chrome
 * literals, verified by hand.
 */
export const ESCAPE_HATCH_PILL: Record<
  'dark' | 'light',
  { fill: string; label: string }
> = {
  dark: { fill: '#fafafa', label: '#0a0a0a' },
  light: { fill: '#0a0a0a', label: '#fafafa' },
};

/**
 * Fixed focus ring for the editor's chrome controls (Randomize, Undo, the mode
 * toggle). Like those recovery controls' fixed fills, the ring stays a fixed
 * blue rather than the editable `--focus-ring` token: a hostile custom palette
 * could set `--focus-ring` to collapse against
 * its own `--base-bg` and make keyboard focus invisible. Fixed `#3b82f6`
 * (`blue-500`) clears 3:1 against both the light and dark page backgrounds. The
 * `forced-colors` outline keeps SC 2.4.7 intact under Windows High Contrast.
 */
export const EDITOR_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText]';
