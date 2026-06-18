/**
 * Brand-locked color literals for the custom API-docs "try it out" explorer.
 *
 * As of Wave 6 the docs components are token-driven (`var(--…)` bundle slots)
 * in BOTH auth states. When logged OUT, `ApiDocsView` pins those bundle tokens
 * to the brand literals defined here via `BRAND_CHROME_STYLE`, so the single
 * token-driven tree resolves to the marketing palette; the `MethodBadge` brand
 * branch is the only remaining consumer of the per-method literals. When logged
 * IN, the active theme's `<html data-theme data-mode>` cascade supplies every
 * slot and these literals are unused.
 *
 * Every literal is verified against BOTH chrome backgrounds (`#0a0812` base,
 * `#14103a` gradient top).
 *
 * Cards carry a subtle translucent fill (`MOUNT_BG`, white @ 5%) so they
 * separate from the navy page rather than floating borderless. Worst case for
 * light-text-on-card is the fill composited over the LIGHTER navy stop
 * (#14103a → card ≈ #201c44); the figures below are measured there (and the
 * border is also checked against the page navy on its OUTER side).
 *
 * Verified contrast (culori `wcagContrast`, June 2026):
 *   TEXT      #eeeede  13.67 (on #201c44 card) / 15.38 (page)  (SC 1.4.3, ≥ 4.5:1)
 *   ALT_TEXT  #c4bce4   8.69 (on #201c44 card)               (SC 1.4.3, ≥ 4.5:1)
 *   BORDER    #7d6ec0   3.71 (card inner) / 4.17–4.60 (page outer)  (SC 1.4.11, ≥ 3:1)
 *   FOCUS     #eeeede  16.96 / 15.38
 *   ERROR_TEXT    #fca5a5  10.47 /  9.50  (red-300; red-500 #ef4444 FAILS text)
 *   ERROR_ACCENT  #ef4444   5.28 /  4.79  (border/icon only, ≥ 3:1)
 *   SUCCESS_TEXT  #86efac  14.16 / 12.84  (green-300; green-500 fails text)
 *   SUCCESS_ACCENT #22c55e  8.72 /  7.91  (border/icon only, ≥ 3:1)
 *   MethodBadge borders on #201c44 card (SC 1.4.11, ≥ 3:1): GET #34d399 8.33,
 *   POST #38bdf8 7.48, PUT/PATCH #fbbf24 9.60, DELETE #f87171 5.79, default 3.71
 */

import type { CSSProperties } from 'react';

/** Primary body + label text, and the focus ring. */
export const TEXT = '#eeeede';

/**
 * Secondary text (descriptions, table data cells). A dimmer lavender than the
 * near-white primary so the two read as a hierarchy rather than one flat tone.
 * Clears SC 1.4.3 (≥ 4.5:1) on the lifted card (~8.69:1).
 */
export const ALT_TEXT = '#c4bce4';

/**
 * Card surface fill — white at 5% over the navy chrome. Lifts cards off the
 * page so they read as panels; keeps the border ≥ 3:1 on its inner side and
 * text ≥ 4.5:1 (see the contrast table above).
 */
export const MOUNT_BG = 'rgba(255, 255, 255, 0.05)';

/** Input + region border, and decorative chrome. Clears SC 1.4.11. */
export const BORDER = '#7d6ec0';

/** Focus ring — pinned to brand white so it clears the chrome gradient. */
export const FOCUS_RING = '#eeeede';

/** Error MESSAGE text. Light red so it clears SC 1.4.3 (4.5:1) for text. */
export const ERROR_TEXT = '#fca5a5';

/** Error border + icon. Mid red — reserved for non-text (≥ 3:1) only. */
export const ERROR_ACCENT = '#ef4444';

/** Success / 2xx status text. Light green, clears SC 1.4.3 for text. */
export const SUCCESS_TEXT = '#86efac';

/** Success border + icon. Mid green — reserved for non-text (≥ 3:1) only. */
export const SUCCESS_ACCENT = '#22c55e';

/**
 * Page background for the brand chrome — the navy base of the `bg-hit-man`
 * radial. Pinned onto `--base-bg` so the global CVD focus-halo
 * (`[data-cvd='on'] *:focus-visible`, index.css) paints brand-coherent.
 */
const BRAND_BASE_BG = '#0a0812';

/**
 * The brand-token pin applied to `ApiDocsView`'s wrapper when logged OUT.
 *
 * The docs components consume bundle tokens via `var(--…)`; this object pins
 * every slot they read to the brand literals above so the token-driven tree
 * paints the marketing palette. Logged-IN, the wrapper omits this object
 * entirely and the active theme's `<html>` cascade supplies the slots.
 *
 * Surfaces covered (§2/§4/§5 of the Wave 6 theming brief):
 *   - base   page bg + header text/border/highlight + focus ring + CVD halo
 *   - mount  card surface: bg, border, text, alt-text, input-bg
 *   - alert  ResponsePanel error region + field/summary validation errors
 *   - success ResponsePanel 2xx region
 */
export const BRAND_CHROME_STYLE = {
  '--base-bg': BRAND_BASE_BG,
  '--base-text': TEXT,
  '--base-border': BORDER,
  '--base-highlight': '#ff9170',
  '--focus-ring': FOCUS_RING,
  '--mount-bg': MOUNT_BG,
  '--mount-border': BORDER,
  '--mount-text': TEXT,
  '--mount-alt-text': ALT_TEXT,
  '--mount-input-bg': 'transparent',
  '--alert-bg': 'transparent',
  '--alert-text': ERROR_TEXT,
  '--alert-highlight': ERROR_ACCENT,
  '--success-bg': 'transparent',
  '--success-text': SUCCESS_TEXT,
  '--success-highlight': SUCCESS_ACCENT,
} as CSSProperties & Record<string, string>;
