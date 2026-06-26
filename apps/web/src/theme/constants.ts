/**
 * All valid theme identifiers, each mapping to a Richard Linklater film.
 * Adding a new theme requires updating this union, the `THEMES` array,
 * `VALID_THEMES` in `apps/api/src/users/users.constants.ts`, and the
 * matching CSS variable file in `apps/web/src/theme/styles/`.
 *
 * The off-book `branding` theme (branding.css) is deliberately absent here
 * by design — registering it would make it user-selectable and break its
 * invisibility contract. See THEMES.md Section 7.
 */
export type BaseTheme =
  | 'apollo-10-1-2'
  | 'before-midnight'
  | 'before-sunrise'
  | 'before-sunset'
  | 'boyhood'
  | 'custom'
  | 'dazed-and-confused'
  | 'hit-man'
  | 'nouvelle-vague'
  | 'scanner-darkly'
  | 'school-of-rock';

/** The two color modes. */
export type Mode = 'light' | 'dark';

/** The theme id for the Apollo 10½ CVD-friendly theme. */
export const CVD_BASE_THEME: BaseTheme = 'apollo-10-1-2';

/**
 * All available themes with their display labels, accent colors, swatch
 * icons, and accessibility flag. The accent color is used for the color dot
 * in the theme submenu; the swatch icon is overlaid on the dot for quick
 * visual identification.
 */
export const THEMES: Array<{
  id: BaseTheme;
  label: string;
  accent: string;
  swatchIcon: string;
  isAccessible?: boolean;
}> = [
  {
    id: 'apollo-10-1-2',
    label: 'Apollo 10½',
    accent: '#4e89c9',
    swatchIcon: 'fa-user-astronaut',
    isAccessible: true,
  },
  {
    id: 'scanner-darkly',
    label: 'A Scanner Darkly',
    accent: '#a3e635',
    swatchIcon: 'fa-eye',
  },
  {
    id: 'before-sunrise',
    label: 'Before Sunrise',
    accent: '#b45309',
    swatchIcon: 'fa-train',
  },
  {
    id: 'before-sunset',
    label: 'Before Sunset',
    accent: '#d97706',
    swatchIcon: 'fa-ferry',
  },
  {
    id: 'before-midnight',
    label: 'Before Midnight',
    accent: '#f59e0b',
    swatchIcon: 'fa-children',
  },
  {
    id: 'boyhood',
    label: 'Boyhood',
    accent: '#86efac',
    swatchIcon: 'fa-child-reaching',
  },
  {
    id: 'dazed-and-confused',
    label: 'Dazed and Confused',
    accent: '#dc2626',
    swatchIcon: 'fa-graduation-cap',
  },
  {
    id: 'hit-man',
    label: 'Hit Man',
    accent: '#f59e0b',
    swatchIcon: 'fa-mask',
  },
  {
    id: 'nouvelle-vague',
    label: 'Nouvelle Vague',
    accent: '#555555',
    swatchIcon: 'fa-film',
  },
  {
    id: 'school-of-rock',
    label: 'School of Rock',
    accent: '#b91c1c',
    swatchIcon: 'fa-guitar',
  },
  {
    // The user-editable custom theme. Its palette lives in the per-user
    // `customTheme` column, not a film-specific CSS file, so the accent is a
    // statically chosen neutral gray (NOT derived from the user's tokens,
    // which may be empty). #808080 clears 3:1 against the menu background in
    // both light and dark mode. `swatchIcon` is special-cased to the generic
    // paintbrush — every other theme uses a film-specific icon. `isAccessible`
    // is intentionally omitted: a user-authored palette can't be assumed
    // CVD-safe. The label is "Your Custom Theme" (the viewer's own); each
    // picker still appends an sr-only "custom theme" qualifier via
    // `customThemeSrSuffix` so it reads unambiguously out of context.
    id: 'custom',
    label: 'Your Custom Theme',
    accent: '#808080',
    swatchIcon: 'fa-paintbrush',
  },
];

export const VALID_BASE_THEME_IDS = new Set<string>(
  THEMES.map((theme) => theme.id),
);

/**
 * The themes the picker menus list. The Custom theme is hidden until the user
 * opts in via the Theme Editor — except when it is the active theme, so the
 * picker always lists the current selection. That exception keeps the radio
 * group's exactly-one-checked invariant intact (a filtered-out active theme
 * would leave the group with zero checked items) and lets a user who is on the
 * Custom theme see and switch away from it. Every non-custom theme always
 * shows.
 */
export function pickerThemes(
  activeTheme: BaseTheme,
  customThemeEnabled: boolean,
): typeof THEMES {
  return THEMES.filter(
    (theme) =>
      theme.id !== 'custom' || customThemeEnabled || activeTheme === 'custom',
  );
}
