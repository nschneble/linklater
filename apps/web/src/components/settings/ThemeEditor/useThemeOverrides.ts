import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { resolveCustomThemeTokens } from '../../../theme/customTheme';
import { readThemeTokens } from './themeProbe';
import { useTheme } from '../../../theme/ThemeContext';
import type { CSSProperties } from 'react';
import type { Mode } from '../../../theme/constants';

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

const SLOT_LABELS: Record<Slot | BaseOnlySlot | BaseAndMountOnlySlot, string> =
  {
    bg: 'Background',
    border: 'Border',
    text: 'Text',
    'alt-text': 'Alt text',
    'subtle-text': 'Subtle text',
    'input-bg': 'Input background',
    highlight: 'Highlight',
    'highlight-fg': 'Highlight text',
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
  items: Array<{
    variable: ThemeVariable;
    label: string;
  }>;
}

export const VAR_GROUPS: BundleGroup[] = BUNDLES.map((bundle) => ({
  bundle,
  label: BUNDLE_LABELS[bundle],
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

export interface UseThemeOverridesResult {
  /** Current (possibly overridden) values for all editable variables. */
  colorValues: Record<ThemeVariable, string>;
  /**
   * Inline custom-property style spread onto the editor's preview subtree.
   * While the custom theme is ENABLED this is the FULL resolved custom palette
   * (so the subtree previews custom independently of the global `:root` theme,
   * which the editor never touches); while DISABLED it is empty, so the subtree
   * inherits the current global theme. The settings card + header sit OUTSIDE
   * this scope, so the controls used to escape an unreadable palette stay
   * painted in the always-readable global theme.
   */
  contentThemeStyle: CSSProperties;
  setOverride: (variable: ThemeVariable, value: string) => void;
  /**
   * Bulk-replaces the override map with a fresh set of token values – used by
   * "Copy from theme" to seed every editable variable from another theme's
   * resolved palette in a single update. Only keys in `EDITABLE_VARS` are
   * applied; unknown keys are ignored. Replaces any in-progress edits. Returns
   * the fully-resolved values it applied so a caller can persist exactly that
   * snapshot immediately (state updates are async).
   */
  loadOverrides: (
    tokens: Record<string, string>,
  ) => Record<ThemeVariable, string>;
  resetOverrides: () => void;
}

/**
 * Manages the Theme Editor's live token values + the inline style that scopes
 * the editor's palette to its preview subtree.
 *
 * The editor NEVER mutates `document.documentElement` / the global theme — and
 * its `editorMode` is LOCAL, decoupled from the site mode: switching it repaints
 * only this subtree, never the live app. While the custom theme is enabled, the
 * baseline is the resolved custom palette (saved tokens + branding fallback) for
 * `editorMode` and `colorValues` track the user's live edits. While disabled,
 * the baseline is the current theme's `editorMode` palette read off a probe (a
 * read-only mirror) so the Light/Dark tabs still swap the preview. Either way
 * `contentThemeStyle` carries the FULL palette as inline custom properties for
 * the preview subtree; the settings card + header sit OUTSIDE that scope.
 *
 * The baseline re-resolves when the enabled flag, `editorMode`, or global theme
 * changes. `customTheme` is read via a ref (NOT an effect dep) so an auto-save
 * writing it back can't clobber an in-progress edit; the first-enable seed is
 * already covered by the enabled-flag flip.
 *
 * @param editorMode Which mode's palette to show + edit (local to the editor).
 * @returns See `UseThemeOverridesResult`.
 */
export function useThemeOverrides(editorMode: Mode): UseThemeOverridesResult {
  const { baseTheme, customTheme, customThemeEnabled } = useTheme();

  const customThemeRef = useRef(customTheme);
  customThemeRef.current = customTheme;

  const readBaseline = useCallback((): Record<ThemeVariable, string> => {
    if (customThemeEnabled) {
      return resolveCustomThemeTokens(
        customThemeRef.current,
        editorMode,
      ) as Record<ThemeVariable, string>;
    }
    // Disabled: mirror the current theme's `editorMode` palette read-only via a
    // probe (never the live `:root`, which is fixed to the site mode), so the
    // Light/Dark tabs swap the preview without flipping the site. The probe
    // drops unset/empty tokens, so backfill every editable var with '' — a row
    // (and the contrast checker) must never read `undefined`.
    const probed = readThemeTokens(baseTheme, editorMode);
    return Object.fromEntries(
      EDITABLE_VARS.map((variable) => [variable, probed[variable] ?? '']),
    ) as Record<ThemeVariable, string>;
  }, [customThemeEnabled, editorMode, baseTheme]);

  const [colorValues, setColorValues] =
    useState<Record<ThemeVariable, string>>(readBaseline);

  const colorValuesRef = useRef(colorValues);
  colorValuesRef.current = colorValues;

  useEffect(() => {
    setColorValues(readBaseline());
  }, [readBaseline]);

  const setOverride = useCallback((variable: ThemeVariable, value: string) => {
    setColorValues((previous) => ({ ...previous, [variable]: value }));
  }, []);

  const loadOverrides = useCallback((tokens: Record<string, string>) => {
    // Seed every editable var; for any the copied palette omits, fall back to
    // the CURRENT shown value so the inputs / contrast checker / saved snapshot
    // never reveal a stale pre-copy value.
    const fallback = colorValuesRef.current;
    const seeded = { ...fallback };
    for (const variable of EDITABLE_VARS) {
      const value = tokens[variable];
      if (typeof value === 'string' && value !== '') {
        seeded[variable] = value;
      }
    }
    setColorValues(seeded);
    return seeded;
  }, []);

  const resetOverrides = useCallback(() => {
    setColorValues(readBaseline());
  }, [readBaseline]);

  // The scoped subtree always paints `colorValues`: when enabled that's the
  // editable custom palette, when disabled it's the current theme's `editorMode`
  // mirror — so the Light/Dark tabs repaint the preview in both states without
  // ever touching the global `:root` (which stays on the site mode).
  const contentThemeStyle = useMemo<CSSProperties>(
    () => colorValues as CSSProperties,
    [colorValues],
  );

  return {
    colorValues,
    contentThemeStyle,
    setOverride,
    loadOverrides,
    resetOverrides,
  };
}
