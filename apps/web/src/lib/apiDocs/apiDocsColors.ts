/**
 * Brand-locked color literals for the custom API-docs "try it out" explorer.
 *
 * The docs page (`ApiDocsView`) carries the marketing brand chrome, NOT the
 * user's theme, so the shared `var(--mount-…)` / `var(--base-…)` bundle tokens
 * resolve to nothing here. Every color the request form paints is therefore a
 * literal pinned to the brand palette and verified against BOTH chrome
 * backgrounds (`#0a0812` base, `#14103a` gradient top).
 *
 * This module is the single seam Wave 6 swaps when these literals become theme
 * tokens — keep ALL request-form color literals here so that migration touches
 * exactly one file.
 *
 * Verified contrast (culori `wcagContrast`, June 2026):
 *   TEXT      #eeeede  16.96 / 15.38  (SC 1.4.3 text, ≥ 4.5:1)
 *   BORDER    #7d6ec0   4.60 /  4.17  (SC 1.4.11 non-text, ≥ 3:1)
 *   FOCUS     #eeeede  16.96 / 15.38
 *   ERROR_TEXT    #fca5a5  10.47 /  9.50  (red-300; red-500 #ef4444 FAILS text)
 *   ERROR_ACCENT  #ef4444   5.28 /  4.79  (border/icon only, ≥ 3:1)
 *   SUCCESS_TEXT  #86efac  14.16 / 12.84  (green-300; green-500 fails text)
 *   SUCCESS_ACCENT #22c55e  8.72 /  7.91  (border/icon only, ≥ 3:1)
 */

/** Primary body + label text, and the focus ring. */
export const TEXT = '#eeeede';

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
