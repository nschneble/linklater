/**
 * All valid theme identifiers, each mapping to a Richard Linklater film.
 * Adding a new theme requires updating this union, the `THEMES` array,
 * `VALID_THEMES` in `apps/api/src/users/users.constants.ts`, and the
 * matching CSS variable file in `apps/web/src/theme/styles/`.
 */
export type BaseTheme =
  | 'apollo-10-1-2'
  | 'before-midnight'
  | 'before-sunrise'
  | 'before-sunset'
  | 'boyhood'
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
    label: 'Nouvelle Vague (Noir)',
    accent: '#555555',
    swatchIcon: 'fa-film',
  },
  {
    id: 'school-of-rock',
    label: 'School of Rock',
    accent: '#b91c1c',
    swatchIcon: 'fa-guitar',
  },
];

export const VALID_BASE_THEME_IDS = new Set<string>(
  THEMES.map((theme) => theme.id),
);
