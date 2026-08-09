// branding is deliberately absent: accepting it would let a client
// persist a theme the user can never see (THEMES.md section 7). custom
// belongs here because its palette lives per-user in the database rather
// than a stylesheet. adding one means touching the front-end theme
// constants and stylesheets too
export const VALID_THEMES = [
  'apollo-10-1-2',
  'before-midnight',
  'before-sunrise',
  'before-sunset',
  'boyhood',
  'custom',
  'dazed-and-confused',
  'hit-man',
  'nouvelle-vague',
  'scanner-darkly',
  'school-of-rock',
] as const;

export const VALID_MODES = ['light', 'dark'] as const;
