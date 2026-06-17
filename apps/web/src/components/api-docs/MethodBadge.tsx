/**
 * Brand-locked HTTP method chip. The method is rendered as real text inside a
 * span marked `aria-hidden` (CONSTRAINT B1): the method already reaches
 * assistive tech through the endpoint's <h3> ("GET /links"), so announcing it
 * again here would double-announce. Color is therefore decorative and the
 * text carries all meaning.
 *
 * The per-method palette is brand-locked (CONSTRAINT B2): light text on the
 * page's navy chrome with a 1px border carrying the boundary. Every text +
 * border pair clears WCAG AA 4.5:1 (text) and 1.4.11 3:1 (border) against
 * BOTH navy stops (#0a0812 base, #14103a gradient top); see the wave's
 * contrast verification. These are constant hex values, NOT theme tokens —
 * dual-theming is a later wave.
 */

interface MethodBadgeProps {
  /** HTTP method, any case (e.g. `'get'`, `'POST'`). Rendered uppercased. */
  method: string;
}

/** Text + border colors per method group. Both clear AA on the navy chrome. */
interface MethodPalette {
  text: string;
  border: string;
}

/** Fallback palette for an unrecognized method — neutral brand grey. */
const DEFAULT_PALETTE: MethodPalette = {
  text: '#eeeede',
  border: '#7d6ec0',
};

/**
 * Brand-locked per-method palettes (CONSTRAINT B2). PUT and PATCH share the
 * amber group. Methods need not stay mutually distinct under CVD because the
 * text label carries the meaning.
 */
const METHOD_PALETTES: Record<string, MethodPalette> = {
  GET: { text: '#a7f3d0', border: '#34d399' },
  POST: { text: '#bae6fd', border: '#38bdf8' },
  PUT: { text: '#fde68a', border: '#fbbf24' },
  PATCH: { text: '#fde68a', border: '#fbbf24' },
  DELETE: { text: '#fecaca', border: '#f87171' },
};

export default function MethodBadge({ method }: MethodBadgeProps) {
  const label = method.toUpperCase();
  const palette = METHOD_PALETTES[label] ?? DEFAULT_PALETTE;

  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center px-2 py-0.5 border text-xs font-semibold tracking-wide rounded-md"
      style={{ color: palette.text, borderColor: palette.border }}
    >
      {label}
    </span>
  );
}
