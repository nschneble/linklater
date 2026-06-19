import { resolveMethodIcon, resolveMethodPalette } from './methodPresentation';
import { useAuth } from '../../auth/AuthContext';

/**
 * Icon variant of MethodBadge: the HTTP method as a decorative Font Awesome
 * glyph inside an `aria-hidden` span. Same two-paint model as MethodBadge —
 * neutral mount tokens logged-in, brand palette logged-out. The method reaches
 * assistive tech through a neighboring sr-only path (EndpointNav), so the
 * glyph and its color are decorative. `aria-hidden` lives on the span; that
 * removes the whole subtree, so the inner <i> needs none.
 *
 * Logged-out color reaches the FA7 webfont glyph via `currentColor` (the span's
 * inline `color`); the glyph is drawn at render time, not baked at build time.
 */

interface MethodIconBadgeProps {
  /** HTTP method, any case (e.g. `'get'`, `'POST'`). */
  method: string;
}

const BADGE_CLASS =
  'inline-flex items-center p-1.5 border text-xs font-semibold tracking-wide rounded-md';

export default function MethodIconBadge({ method }: MethodIconBadgeProps) {
  const { user } = useAuth();
  const methodIcon = resolveMethodIcon(method);

  // Themed (logged-in): neutral mount token on both the border and the glyph.
  if (user !== null) {
    return (
      <span
        aria-hidden="true"
        className={`${BADGE_CLASS} border-[var(--mount-border)]`}
      >
        <i
          className={`fa-solid ${methodIcon} text-[var(--mount-text)] text-xs`}
        />
      </span>
    );
  }

  // Brand (logged-out): per-method palette; the glyph inherits the span color.
  const palette = resolveMethodPalette(method);
  return (
    <span
      aria-hidden="true"
      className={BADGE_CLASS}
      style={{ color: palette.text, borderColor: palette.border }}
    >
      <i className={`fa-solid ${methodIcon} text-xs`} />
    </span>
  );
}
