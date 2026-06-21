/**
 * Canonical bundle-token vocabulary for the Custom theme.
 *
 * This module is the SINGLE SOURCE OF TRUTH for which CSS custom properties a
 * Custom theme may define, inject, persist, and copy. It lives in `theme/`
 * (not in the settings editor) because the token vocabulary is core theme
 * data: the runtime injection in `ThemeContext` and the trust-boundary
 * normalizer in `customTheme.ts` depend on it, and the Theme Editor depends on
 * it too. Defining it here inverts the former `theme → settings → theme`
 * import cycle so the editor imports from `theme/`, never the reverse.
 *
 * The Theme Editor re-exports these names (`useThemeOverrides.ts`) so existing
 * editor-side consumers keep working unchanged.
 */

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
 * surface – they must clear 3:1 against `--base-bg` per WCAG SC 1.4.11.
 */
export const CARD_BUNDLES: ReadonlyArray<Bundle> = [
  'mount',
  'orbit',
  'alert',
  'warn',
  'info',
  'success',
];

export const SLOTS = [
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
 * chevrons) – see bundles.css preamble. Mount/orbit/state bundles do not
 * carry this slot by design.
 */
export const BASE_ONLY_SLOTS = ['subtle-text'] as const;
export type BaseOnlySlot = (typeof BASE_ONLY_SLOTS)[number];

/**
 * Slots that only exist on base + mount bundles. `input-bg` is the form
 * input fill – tuned per-surface so inputs read as inset against either
 * page chrome (base) or card surface (mount). Orbit/state bundles don't
 * host form inputs.
 */
export const BASE_AND_MOUNT_ONLY_SLOTS = ['input-bg'] as const;
export type BaseAndMountOnlySlot = (typeof BASE_AND_MOUNT_ONLY_SLOTS)[number];

/**
 * The universal focus-ring token. Unlike the per-bundle slots it is a single
 * chrome-wide variable (drives `:focus-visible` across every surface), so it
 * is not a `--{bundle}-{slot}`. For the Custom theme it is editable + injected
 * like any other token so the user can set it AND its contrast becomes
 * verifiable in the live checker; for the 10 film themes it resolves from the
 * per-theme `.css` cascade as before.
 */
export const FOCUS_RING_VAR = '--focus-ring' as const;

/**
 * The full set of bundle tokens the editor can override and the Custom theme
 * can inject/persist: 7 bundles × 7 slots = 49, plus 1 base-only
 * `subtle-text` slot, 2 base/mount `input-bg` slots, and the universal
 * `--focus-ring`. Per-bundle, `bundles.css` may declare fewer – base/mount/
 * orbit omit `highlight-fg` / `highlight-hover`; the editor still exposes
 * overrides for those so users can add them.
 */
export const EDITABLE_VARS = [
  ...BUNDLES.flatMap((bundle) =>
    SLOTS.map((slot) => `--${bundle}-${slot}` as const),
  ),
  ...BASE_ONLY_SLOTS.map((slot) => `--base-${slot}` as const),
  ...BASE_AND_MOUNT_ONLY_SLOTS.flatMap(
    (slot) => [`--base-${slot}`, `--mount-${slot}`] as const,
  ),
  FOCUS_RING_VAR,
];

/** The union of all CSS variable names that the editor can modify. */
export type ThemeVariable = (typeof EDITABLE_VARS)[number];
