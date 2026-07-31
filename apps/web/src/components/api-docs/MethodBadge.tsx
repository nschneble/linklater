import { resolveMethodPalette } from './methodPresentation';
import { useAuth } from '../../auth/AuthContext';

/**
 * HTTP method chip. The method is rendered as real text inside a span marked
 * `aria-hidden` (CONSTRAINT B1): the method already reaches assistive tech
 * through the endpoint's <h3> ("GET /links"), so announcing it again here
 * would double-announce. Color is therefore decorative and the text carries
 * all meaning.
 *
 * Two paints depending on auth:
 *   - Logged IN (themed): a single NEUTRAL mount treatment – `--mount-text`
 *     text on a `--mount-border` outline (a verified bundle pair). Method is
 *     decorative (B1), so a per-method × per-theme color matrix buys zero a11y
 *     value and is not maintained.
 *   - Logged OUT (brand): the brand-locked per-method palette from
 *     `methodPresentation` – light text on the navy chrome with a 1px border.
 */

interface MethodBadgeProps {
  /** HTTP method, any case (e.g. `'get'`, `'POST'`). Rendered uppercased. */
  method: string;
}

const BADGE_CLASS =
  'inline-flex items-center px-2 py-0.5 border text-xs font-semibold tracking-wide rounded-md';

export default function MethodBadge({ method }: MethodBadgeProps) {
  const { user } = useAuth();
  const label = method.toUpperCase();

  // themed (logged-in): neutral mount pair, no per-method color
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

  // brand (logged-out): per-method palette painted as literals.
  const palette = resolveMethodPalette(method);
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
