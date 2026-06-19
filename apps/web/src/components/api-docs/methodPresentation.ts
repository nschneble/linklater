/**
 * Decorative per-HTTP-method presentation shared across the API docs: the
 * brand color palette (MethodBadge, MethodIconBadge) and the icon glyph
 * (MethodIconBadge, EndpointDetail). All three views are decorative — the
 * method reaches assistive tech through a neighboring <h3> or sr-only path —
 * so color and glyph carry no meaning and need not survive CVD.
 *
 * The brand palette is logged-out only; the themed (logged-in) paint uses
 * neutral mount bundle tokens instead. Every text + border pair clears WCAG AA
 * 4.5:1 (text) and 1.4.11 3:1 (border) against BOTH navy chrome stops
 * (#0a0812 base, #14103a gradient top); see the bundle contrast verification.
 */

/** Foreground + border colors for one method group. */
export interface MethodPalette {
  /** Chip text, or the icon glyph via `currentColor`. */
  text: string;
  border: string;
}

/** Fallback palette for an unrecognized method – neutral brand grey. */
export const DEFAULT_PALETTE: MethodPalette = {
  text: '#eeeede',
  border: '#7d6ec0',
};

/** Per-method palettes. PUT and PATCH share the amber group. */
export const METHOD_PALETTES: Record<string, MethodPalette> = {
  GET: { text: '#a7f3d0', border: '#34d399' },
  POST: { text: '#bae6fd', border: '#38bdf8' },
  PUT: { text: '#fde68a', border: '#fbbf24' },
  PATCH: { text: '#fde68a', border: '#fbbf24' },
  DELETE: { text: '#fecaca', border: '#f87171' },
};

/** Font Awesome glyph per method. PUT and PATCH share the pen. */
export const METHOD_ICONS: Record<string, string> = {
  GET: 'fa-magnifying-glass',
  POST: 'fa-plus',
  PUT: 'fa-pen',
  PATCH: 'fa-pen',
  DELETE: 'fa-trash-can',
};

/** Fallback glyph for an unrecognized method. */
export const DEFAULT_ICON = 'fa-code';

/** Resolve the brand palette for a method (any case), neutral grey if unknown. */
export function resolveMethodPalette(method: string): MethodPalette {
  return METHOD_PALETTES[method.toUpperCase()] ?? DEFAULT_PALETTE;
}

/** Resolve the icon glyph for a method (any case), `fa-code` if unknown. */
export function resolveMethodIcon(method: string): string {
  return METHOD_ICONS[method.toUpperCase()] ?? DEFAULT_ICON;
}
