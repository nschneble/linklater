import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BASE_AND_MOUNT_ONLY_SLOTS,
  BASE_ONLY_SLOTS,
  BUNDLES,
  CARD_BUNDLES,
  EDITABLE_VARS,
  FOCUS_RING_VAR,
  SLOTS,
  type BaseAndMountOnlySlot,
  type BaseOnlySlot,
  type Bundle,
  type Slot,
  type ThemeVariable,
} from '../../../theme/customThemeTokens';
import { collectTokens } from '../../../theme/customTheme';
import { useTheme } from '../../../theme/ThemeContext';
import type { CSSProperties } from 'react';

// Re-export the canonical token vocabulary (now single-sourced in `theme/`)
// so existing editor-side consumers keep importing it from here unchanged.
export {
  BUNDLES,
  CARD_BUNDLES,
  EDITABLE_VARS,
  FOCUS_RING_VAR,
  type BaseAndMountOnlySlot,
  type BaseOnlySlot,
  type Bundle,
  type Slot,
  type ThemeVariable,
};

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

const FOCUS_RING_LABEL = 'Focus ring';

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
      label: SLOT_LABELS[slot],
    })),
    ...(bundle === 'base'
      ? BASE_ONLY_SLOTS.map((slot) => ({
          variable: `--base-${slot}` as ThemeVariable,
          label: SLOT_LABELS[slot],
        }))
      : []),
    ...(bundle === 'base' || bundle === 'mount'
      ? BASE_AND_MOUNT_ONLY_SLOTS.map((slot) => ({
          variable: `--${bundle}-${slot}` as ThemeVariable,
          label: SLOT_LABELS[slot],
        }))
      : []),
    // The universal focus ring rides on the base group: it is page-chrome
    // adjacent and has no bundle of its own. Editing it here makes its
    // contrast verifiable in the live checker (W1).
    ...(bundle === 'base'
      ? [{ variable: FOCUS_RING_VAR as ThemeVariable, label: FOCUS_RING_LABEL }]
      : []),
  ],
}));

/**
 * Returns true when the value cannot be edited via a native `<input
 * type="color">` (which only supports 6-digit hex without alpha). Alpha
 * tokens – typically dark-mode state bundle bgs like `rgb(76 5 25 / 0.4)` –
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
  /**
   * Bulk-replaces the override map with a fresh set of token values – used by
   * "Copy from theme" to seed every editable variable from another theme's
   * resolved palette in a single update. Only keys in `EDITABLE_VARS` are
   * applied; unknown keys are ignored. Replaces any in-progress edits.
   */
  loadOverrides: (tokens: Record<string, string>) => void;
  resetOverrides: () => void;
  resetBundle: (bundle: Bundle) => void;
}

/**
 * Manages live CSS variable overrides for the theme editor.
 *
 * Overrides live in React state only – the hook never mutates
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

  const loadOverrides = useCallback((tokens: Record<string, string>) => {
    // Seed BOTH overrides and colorValues for the full canonical set. A copied
    // theme may resolve fewer than every key; for those gaps fall back to the
    // current computed value so colorValues / inputs / the contrast checker /
    // the saved snapshot can never show a stale pre-copy value (W3).
    const computed = readAllComputedVars();
    const next = collectTokens(
      EDITABLE_VARS,
      (variable) => tokens[variable],
    ) as Partial<Record<ThemeVariable, string>>;
    const seededColorValues = { ...computed };
    for (const variable of EDITABLE_VARS) {
      seededColorValues[variable] = next[variable] ?? computed[variable];
    }
    setOverrides(next);
    setColorValues(seededColorValues);
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
    // The focus ring rides on the base group, so resetting base resets it too.
    if (bundle === 'base') {
      variablesForBundle.push(FOCUS_RING_VAR);
    }

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
    loadOverrides,
    resetOverrides,
    resetBundle,
  };
}
