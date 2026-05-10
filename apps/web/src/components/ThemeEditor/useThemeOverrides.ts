import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';

/**
 * The CSS custom properties that can be overridden in the theme editor.
 * Adding a new variable here automatically makes it appear in `ColorEditor`
 * (via `VAR_GROUPS`) and in the contrast checker (if added to `CONTRAST_PAIRS`).
 */
export const EDITABLE_VARS = [
  '--bg',
  '--bg-surface',
  '--bg-elevated',
  '--bg-input',
  '--text',
  '--text-muted',
  '--text-subtle',
  '--border',
  '--accent',
  '--accent-fg',
] as const;

/** The union of all CSS variable names that the editor can modify. */
export type ThemeVariable = (typeof EDITABLE_VARS)[number];

/**
 * Groupings used by `ColorEditor` to render the variable list with labeled
 * sections (Backgrounds, Text, Border, Accent).
 */
export const VAR_GROUPS: Array<{
  label: string;
  items: Array<{ variable: ThemeVariable; label: string }>;
}> = [
  {
    label: 'Backgrounds',
    items: [
      { variable: '--bg', label: 'Base' },
      { variable: '--bg-surface', label: 'Surface' },
      { variable: '--bg-elevated', label: 'Elevated' },
      { variable: '--bg-input', label: 'Input' },
    ],
  },
  {
    label: 'Text',
    items: [
      { variable: '--text', label: 'Primary' },
      { variable: '--text-muted', label: 'Muted' },
      { variable: '--text-subtle', label: 'Subtle' },
    ],
  },
  {
    label: 'Border',
    items: [{ variable: '--border', label: 'Border' }],
  },
  {
    label: 'Accent',
    items: [
      { variable: '--accent', label: 'Primary' },
      { variable: '--accent-fg', label: 'Foreground' },
    ],
  },
];

/**
 * Reads the current computed values of all `EDITABLE_VARS` from
 * `document.documentElement`. Called on mount and whenever the base theme or
 * mode changes to reset the editor state.
 */
function readAllComputedVars(): Record<ThemeVariable, string> {
  const computedStyle = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    EDITABLE_VARS.map((variable) => [
      variable,
      computedStyle.getPropertyValue(variable).trim(),
    ]),
  ) as Record<ThemeVariable, string>;
}

/**
 * Removes all inline style overrides from `document.documentElement`,
 * restoring the values defined by the active theme stylesheet.
 */
function clearAllInlineOverrides(): void {
  const root = document.documentElement;
  for (const variable of EDITABLE_VARS) {
    root.style.removeProperty(variable);
  }
}

/**
 * Manages live CSS variable overrides for the theme editor.
 *
 * Overrides are applied by setting inline styles on `document.documentElement`.
 * This takes precedence over stylesheet-defined variables so changes are
 * immediately visible across the entire page.
 *
 * Overrides are cleared automatically when:
 * - The base theme or mode changes (so the new theme's values are used as the
 *   new baseline).
 * - The component unmounts (cleanup effect) so navigating away from the editor
 *   restores the page to the selected theme.
 *
 * @returns
 * - `colorValues` — the current (possibly overridden) hex values for all editable variables.
 * - `setOverride` — applies a single variable override immediately.
 * - `resetOverrides` — removes all overrides and re-reads the computed values.
 */
export function useThemeOverrides() {
  const { baseTheme, mode } = useTheme();
  const [colorValues, setColorValues] =
    useState<Record<ThemeVariable, string>>(readAllComputedVars);

  useEffect(() => {
    clearAllInlineOverrides();
    setColorValues(readAllComputedVars());
  }, [baseTheme, mode]);

  useEffect(() => {
    return clearAllInlineOverrides;
  }, []);

  const setOverride = useCallback((variable: ThemeVariable, value: string) => {
    document.documentElement.style.setProperty(variable, value);
    setColorValues((previous) => ({ ...previous, [variable]: value }));
  }, []);

  const resetOverrides = useCallback(() => {
    clearAllInlineOverrides();
    setColorValues(readAllComputedVars());
  }, []);

  return { colorValues, setOverride, resetOverrides };
}
