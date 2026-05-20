/**
 * All valid theme identifiers accepted by the API. Each theme corresponds to
 * a Richard Linklater film. Adding a new theme requires updating this list,
 * the front-end `THEMES` array in `ThemeContext.tsx`, and adding the matching
 * CSS variable definitions in `apps/web/src/theme/styles/`.
 */
export const VALID_THEMES = [
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
