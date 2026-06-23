import type { CSSProperties } from 'react';

/**
 * Fixed neutral palette for the Theme Editor's ONE guaranteed escape hatch:
 * "Reset all". Every other chrome control now paints from the active theme's
 * bundle tokens, so a hostile or unreadable custom palette can degrade them.
 * Reset all deliberately does NOT read bundle tokens — its opaque light fill
 * stays readable on any theme, and clicking it reverts the custom theme to the
 * branding defaults, so there is always a visible way back to a readable state.
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
 * Fixed focus ring for the editor's chrome controls. Like the Reset escape
 * hatch, the ring stays a fixed blue rather than the editable `--focus-ring`
 * token: a hostile custom palette could set `--focus-ring` to collapse against
 * its own `--base-bg` and make keyboard focus invisible. Fixed `#3b82f6`
 * (`blue-500`) clears 3:1 against both the light and dark page backgrounds. The
 * `forced-colors` outline keeps SC 2.4.7 intact under Windows High Contrast.
 */
export const EDITOR_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText]';
