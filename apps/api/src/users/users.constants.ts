/**
 * All valid theme identifiers accepted by the API. Each theme corresponds to
 * a Richard Linklater film. Adding a new theme requires updating this list,
 * the front-end `THEMES` array and `BaseTheme` union in
 * `apps/web/src/theme/constants.ts`, and adding the matching CSS variable
 * definitions in `apps/web/src/theme/styles/`.
 *
 * The off-book `branding` theme (branding.css) is deliberately absent here by
 * design — accepting it would let a client persist a user-invisible theme and
 * break its invisibility contract. See THEMES.md Section 7.
 */
export const VALID_THEMES = [
  'apollo-10-1-2',
  'before-midnight',
  'before-sunrise',
  'before-sunset',
  'boyhood',
  'dazed-and-confused',
  'hit-man',
  'nouvelle-vague',
  'scanner-darkly',
  'school-of-rock',
] as const;

/**
 * The two supported color modes. `light` renders a pale background with dark
 * text; `dark` renders a dark background with light text. The initial mode
 * on first visit is determined by the OS `prefers-color-scheme` media query.
 */
export const VALID_MODES = ['light', 'dark'] as const;
