import { useAuth } from '../../auth/AuthContext';

/**
 * HTTP method chip. The method is rendered as real text inside a span marked
 * `aria-hidden` (CONSTRAINT B1): the method already reaches assistive tech
 * through the endpoint's <h3> ("GET /links"), so announcing it again here
 * would double-announce. Color is therefore decorative and the text carries
 * all meaning.
 *
 * Two paints depending on auth (Wave 6):
 *   - Logged IN (themed): a single NEUTRAL mount treatment — `--mount-text`
 *     text on a `--mount-border` outline (a verified bundle pair). Method is
 *     decorative (B1), so a per-method × per-theme color matrix buys zero a11y
 *     value and is not maintained.
 *   - Logged OUT (brand): the brand-locked per-method palette below — light
 *     text on the navy chrome with a 1px border. Every text + border pair
 *     clears WCAG AA 4.5:1 (text) and 1.4.11 3:1 (border) against BOTH navy
 *     stops (#0a0812 base, #14103a gradient top); see the wave's contrast
 *     verification.
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
 * Brand-locked per-method palettes (logged-out only). PUT and PATCH share the
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

const BADGE_CLASS =
  'inline-flex items-center px-2 py-0.5 border text-xs font-semibold tracking-wide rounded-md';

export default function MethodBadge({ method }: MethodBadgeProps) {
  const { user } = useAuth();
  const label = method.toUpperCase();

  // Themed (logged-in): neutral mount text/border bundle pair, no per-method
  // color. The token classes resolve to the active theme's mount slots.
  if (user !== null) {
    return (
      <span
        aria-hidden="true"
        className={`${BADGE_CLASS} border-[var(--mount-border)] text-[var(--mount-text)]`}
      >
        {label}
      </span>
    );
  }

  // Brand (logged-out): per-method palette painted as literals.
  const palette = METHOD_PALETTES[label] ?? DEFAULT_PALETTE;
  return (
    <span
      aria-hidden="true"
      className={BADGE_CLASS}
      style={{ color: palette.text, borderColor: palette.border }}
    >
      {label}
    </span>
  );
}
