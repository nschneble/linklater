import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../../theme/ThemeContext';

/**
 * The 7 bundles in importance order: page chrome first, then card variants
 * by frequency, then status bundles by severity.
 */
export const BUNDLES = [
  'base',
  'mount',
  'orbit',
  'alert',
  'warn',
  'info',
  'success',
] as const;
export type Bundle = (typeof BUNDLES)[number];

/**
 * Card-style bundles (everything except base) whose border touches the page
 * surface — they must clear 3:1 against `--base-bg` per WCAG SC 1.4.11.
 */
export const CARD_BUNDLES: ReadonlyArray<Bundle> = [
  'mount',
  'orbit',
  'alert',
  'warn',
  'info',
  'success',
];

const SLOTS = [
  'bg',
  'border',
  'text',
  'alt-text',
  'highlight',
  'highlight-fg',
  'highlight-hover',
] as const;
export type Slot = (typeof SLOTS)[number];

/**
 * Slots that only exist on the base bundle. `subtle-text` is the
 * lowest-emphasis text tier used by page chrome (kbd legends, helper hints,
 * chevrons) — see bundles.css preamble. Mount/orbit/state bundles do not
 * carry this slot by design.
 */
const BASE_ONLY_SLOTS = ['subtle-text'] as const;
export type BaseOnlySlot = (typeof BASE_ONLY_SLOTS)[number];

/**
 * Slots that only exist on base + mount bundles. `input-bg` is the form
 * input fill — tuned per-surface so inputs read as inset against either
 * page chrome (base) or card surface (mount). Orbit/state bundles don't
 * host form inputs.
 */
const BASE_AND_MOUNT_ONLY_SLOTS = ['input-bg'] as const;
export type BaseAndMountOnlySlot = (typeof BASE_AND_MOUNT_ONLY_SLOTS)[number];

const BUNDLE_LABELS: Record<Bundle, string> = {
  base: 'Base',
  mount: 'Mount',
  orbit: 'Orbit',
  alert: 'Alert',
  warn: 'Warn',
  info: 'Info',
  success: 'Success',
};

const BUNDLE_DESCRIPTIONS: Record<Bundle, string> = {
  base: 'Page chrome',
  mount: 'Cards, panels',
  orbit: 'Menus, dropdowns',
  alert: 'Errors, danger zones',
  warn: 'Yellow banners',
  info: 'Tips, hints',
  success: 'Verified, notifications',
};

const SLOT_LABELS: Record<Slot | BaseOnlySlot | BaseAndMountOnlySlot, string> =
  {
    bg: 'Background',
    border: 'Border',
    text: 'Text',
    'alt-text': 'Alt text',
    'subtle-text': 'Subtle text',
    'input-bg': 'Input background',
    highlight: 'Highlight',
    'highlight-fg': 'Highlight foreground',
    'highlight-hover': 'Highlight hover',
  };

/**
 * 52 bundle tokens (7 bundles × 7 slots + 1 base-only `subtle-text` slot
 * + 2 base/mount `input-bg` slots). Each theme defines values for these
 * in `bundles.css`; the editor exposes them as overrides.
 */
export const EDITABLE_VARS = [
  ...BUNDLES.flatMap((bundle) =>
    SLOTS.map((slot) => `--${bundle}-${slot}` as const),
  ),
  ...BASE_ONLY_SLOTS.map((slot) => `--base-${slot}` as const),
  ...BASE_AND_MOUNT_ONLY_SLOTS.flatMap(
    (slot) => [`--base-${slot}`, `--mount-${slot}`] as const,
  ),
];

/** The union of all CSS variable names that the editor can modify. */
export type ThemeVariable = (typeof EDITABLE_VARS)[number];

/**
 * Groupings used by `ColorEditor` to render the variable list with labeled
 * disclosure sections, one per bundle.
 */
export interface BundleGroup {
  bundle: Bundle;
  label: string;
  description: string;
  items: Array<{
    variable: ThemeVariable;
    slot: Slot | BaseOnlySlot | BaseAndMountOnlySlot;
    label: string;
  }>;
}

export const VAR_GROUPS: BundleGroup[] = BUNDLES.map((bundle) => ({
  bundle,
  label: BUNDLE_LABELS[bundle],
  description: BUNDLE_DESCRIPTIONS[bundle],
  items: [
    ...SLOTS.map((slot) => ({
      variable: `--${bundle}-${slot}` as ThemeVariable,
      slot,
      label: SLOT_LABELS[slot],
    })),
    ...(bundle === 'base'
      ? BASE_ONLY_SLOTS.map((slot) => ({
          variable: `--base-${slot}` as ThemeVariable,
          slot,
          label: SLOT_LABELS[slot],
        }))
      : []),
    ...(bundle === 'base' || bundle === 'mount'
      ? BASE_AND_MOUNT_ONLY_SLOTS.map((slot) => ({
          variable: `--${bundle}-${slot}` as ThemeVariable,
          slot,
          label: SLOT_LABELS[slot],
        }))
      : []),
  ],
}));

/**
 * Returns true when the value cannot be edited via a native `<input
 * type="color">` (which only supports 6-digit hex without alpha). Alpha
 * tokens — typically dark-mode state bundle bgs like `rgb(76 5 25 / 0.4)` —
 * keep the text input enabled but disable the color picker.
 */
export function isAlphaValue(value: string): boolean {
  const trimmed = value.trim();
  return /^rgba?\(/i.test(trimmed) || /^#[0-9a-fA-F]{8}$/.test(trimmed);
}

/**
 * Reads the current computed values of all `EDITABLE_VARS` from
 * `document.documentElement`. Called on mount and whenever the base theme
 * or mode changes to reset the editor state.
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
 * Removes inline style overrides for a single bundle's 7 slots, leaving
 * the other bundles untouched. Used by per-bundle reset controls.
 */
function clearBundleInlineOverrides(bundle: Bundle): void {
  const root = document.documentElement;
  for (const slot of SLOTS) {
    root.style.removeProperty(`--${bundle}-${slot}`);
  }
  if (bundle === 'base') {
    for (const slot of BASE_ONLY_SLOTS) {
      root.style.removeProperty(`--base-${slot}`);
    }
  }
  if (bundle === 'base' || bundle === 'mount') {
    for (const slot of BASE_AND_MOUNT_ONLY_SLOTS) {
      root.style.removeProperty(`--${bundle}-${slot}`);
    }
  }
}

/**
 * Manages live CSS variable overrides for the theme editor.
 *
 * Overrides are applied by setting inline styles on
 * `document.documentElement`. This takes precedence over stylesheet-defined
 * variables so changes are immediately visible across the entire page.
 *
 * Overrides are cleared automatically when:
 * - The base theme or mode changes (so the new theme's values are used as
 *   the new baseline).
 * - The component unmounts (cleanup effect) so navigating away from the
 *   editor restores the page to the selected theme.
 *
 * @returns
 * - `colorValues` — current (possibly overridden) values for all editable variables.
 * - `setOverride` — applies a single variable override immediately.
 * - `resetOverrides` — removes all overrides and re-reads the computed values.
 * - `resetBundle` — removes overrides for a single bundle's 7 slots.
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

  const resetBundle = useCallback((bundle: Bundle) => {
    clearBundleInlineOverrides(bundle);
    setColorValues(readAllComputedVars());
  }, []);

  return { colorValues, setOverride, resetOverrides, resetBundle };
}
