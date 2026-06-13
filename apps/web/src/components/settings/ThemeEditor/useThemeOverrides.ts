import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import type { CSSProperties } from 'react';

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
 * 52 bundle tokens the editor can override (7 bundles × 7 slots = 49,
 * plus 1 base-only `subtle-text` slot + 2 base/mount `input-bg` slots).
 * Per-bundle, `bundles.css` may declare fewer — base/mount/orbit omit
 * `highlight-fg` / `highlight-hover`. The editor still exposes overrides
 * for those so users can add them.
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

export interface UseThemeOverridesResult {
  /** Current (possibly overridden) values for all editable variables. */
  colorValues: Record<ThemeVariable, string>;
  /**
   * Inline style object containing only the variables the user has actively
   * overridden. Spread onto a wrapper element that scopes the live preview;
   * the editor chrome continues to inherit from the active theme at `:root`
   * so a hostile bundle edit can't lock the user out of the editor itself.
   */
  overrideStyle: CSSProperties;
  setOverride: (variable: ThemeVariable, value: string) => void;
  resetOverrides: () => void;
  resetBundle: (bundle: Bundle) => void;
}

/**
 * Manages live CSS variable overrides for the theme editor.
 *
 * Overrides live in React state only — the hook never mutates
 * `document.documentElement.style`. Consumers spread `overrideStyle` onto
 * the wrapper element that owns the live preview (typically the showcase
 * column). The editor chrome itself continues to paint from the active
 * theme at `:root`, so the user can never edit themselves into an
 * unrecoverable state by setting bundle slots to unreadable values.
 *
 * Overrides are cleared automatically when the base theme or mode changes
 * (so the new theme's values are used as the new baseline).
 *
 * @returns See `UseThemeOverridesResult`.
 */
export function useThemeOverrides(): UseThemeOverridesResult {
  const { baseTheme, mode } = useTheme();
  const [colorValues, setColorValues] =
    useState<Record<ThemeVariable, string>>(readAllComputedVars);
  const [overrides, setOverrides] = useState<
    Partial<Record<ThemeVariable, string>>
  >({});

  useEffect(() => {
    setOverrides({});
    setColorValues(readAllComputedVars());
  }, [baseTheme, mode]);

  const setOverride = useCallback((variable: ThemeVariable, value: string) => {
    setOverrides((previous) => ({ ...previous, [variable]: value }));
    setColorValues((previous) => ({ ...previous, [variable]: value }));
  }, []);

  const resetOverrides = useCallback(() => {
    setOverrides({});
    setColorValues(readAllComputedVars());
  }, []);

  const resetBundle = useCallback((bundle: Bundle) => {
    const slotsForBundle: Array<string> = [...SLOTS];
    if (bundle === 'base') {
      slotsForBundle.push(...BASE_ONLY_SLOTS);
    }
    if (bundle === 'base' || bundle === 'mount') {
      slotsForBundle.push(...BASE_AND_MOUNT_ONLY_SLOTS);
    }
    const variablesForBundle = slotsForBundle.map(
      (slot) => `--${bundle}-${slot}` as ThemeVariable,
    );

    setOverrides((previous) => {
      const next = { ...previous };
      for (const variable of variablesForBundle) {
        delete next[variable];
      }
      return next;
    });

    // Re-read computed vars so colorValues for this bundle reflect the theme
    // defaults again. Only replace this bundle's values; preserve any
    // in-progress edits to other bundles.
    const fresh = readAllComputedVars();
    setColorValues((previous) => {
      const next = { ...previous };
      for (const variable of variablesForBundle) {
        next[variable] = fresh[variable];
      }
      return next;
    });
  }, []);

  const overrideStyle = useMemo(() => overrides as CSSProperties, [overrides]);

  return {
    colorValues,
    overrideStyle,
    setOverride,
    resetOverrides,
    resetBundle,
  };
}
