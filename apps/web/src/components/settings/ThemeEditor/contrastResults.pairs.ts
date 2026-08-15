import {
  BUNDLES,
  CARD_BUNDLES,
  EDITABLE_VARS,
  type Bundle,
  type ThemeVariable,
} from './useThemeOverrides';

/*
 * WHAT the bundle contract requires, with no opinion on how it is measured.
 *
 * Two consumers read this and they measure differently: the live editor
 * composites each background down the stack it renders in, and the Randomize
 * generator solves the same pairs as flat two-endpoint ratios, which is sound
 * there because every value it emits is opaque. Keeping the pair list in its
 * own module is what makes that a structural fact rather than a promise in a
 * comment: neither model owns the contract, so neither can quietly check a
 * different set of pairs than the other.
 *
 * A pair missing here is therefore missing from both, which is how the
 * form inputs went unscored in the editor and unsolved in the generator
 * while the shipped stylesheets were held to them all along.
 */

/** A foreground/background color pair to test for WCAG contrast compliance. */
export interface ContrastPair {
  /** Human-readable description shown in the UI. */
  label: string;
  /** The CSS variable name of the foreground color. */
  foreground: string;
  /** The CSS variable name of the background color. */
  background: string;
  /** WCAG success criterion this pair satisfies. */
  criterion: '1.4.3' | '1.4.11';
  /** Minimum contrast ratio to pass the criterion. */
  threshold: number;
}

/**
 * The bundles that host a form input, read off the token vocabulary rather
 * than listed, so a bundle that gains or loses the slot carries its pairs
 * with it instead of waiting for someone to notice.
 */
export const INPUT_FILL_BUNDLES: ReadonlyArray<Bundle> = BUNDLES.filter(
  (bundle) => EDITABLE_VARS.includes(`--${bundle}-input-bg` as ThemeVariable),
);

/** One pair as slot names, resolved against the bundle asking for it. */
type SlotSpec = readonly [
  label: string,
  foreground: string,
  background: string,
  criterion: ContrastPair['criterion'],
  threshold: number,
];

/** What every bundle owes against its own background. */
const BUNDLE_SPECS: readonly SlotSpec[] = [
  ['text / bg', 'text', 'bg', '1.4.3', 4.5],
  ['alt-text / bg', 'alt-text', 'bg', '1.4.3', 4.5],
  ['border / bg', 'border', 'bg', '1.4.11', 3],
  ['highlight / bg', 'highlight', 'bg', '1.4.11', 3],
  ['hl-fg / hl', 'highlight-fg', 'highlight', '1.4.3', 4.5],
  ['hl-fg / hl-hover', 'highlight-fg', 'highlight-hover', '1.4.3', 4.5],
];

/**
 * What a bundle owes against its form-input fill. The fill is a surface of
 * its own, not a shade of the bundle background, so clearing one says
 * nothing about the other. The placeholder tier is functional text, which
 * is why it answers to 1.4.3 rather than to the non-text threshold.
 */
const INPUT_FILL_SPECS: readonly SlotSpec[] = [
  ['text / input-bg', 'text', 'input-bg', '1.4.3', 4.5],
  ['alt-text / input-bg', 'alt-text', 'input-bg', '1.4.3', 4.5],
  ['border / input-bg', 'border', 'input-bg', '1.4.11', 3],
];

/**
 * The surfaces a focus ring is drawn against. It must clear 3:1 on each
 * (SC 1.4.11 / SC 2.4.13), the same surfaces the static bundle suite
 * enforces. The editor checks the three highest-frequency chrome surfaces
 * (page, card, menu); the static suite covers the remaining state-bundle
 * backgrounds.
 *
 * The input fills belong here because a focused text input hides its own
 * border and draws the outline where that border was, so for as long as the
 * input has focus the outline is its only boundary and its inner edge meets
 * the fill. For the Custom theme the ring is an editable, injected token (W1),
 * so these pairs resolve from live values like any other slot instead of
 * reading as unverified.
 */
const FOCUS_RING_SURFACES: ReadonlyArray<{
  label: string;
  background: string;
}> = [
  { label: 'focus-ring / base-bg', background: '--base-bg' },
  { label: 'focus-ring / mount-bg', background: '--mount-bg' },
  { label: 'focus-ring / orbit-bg', background: '--orbit-bg' },
  ...INPUT_FILL_BUNDLES.map((bundle) => ({
    label: `focus-ring / ${bundle}-input-bg`,
    background: `--${bundle}-input-bg`,
  })),
];

function specPairs(bundle: Bundle, specs: readonly SlotSpec[]): ContrastPair[] {
  return specs.map(([label, foreground, background, criterion, threshold]) => ({
    label,
    foreground: `--${bundle}-${foreground}`,
    background: `--${bundle}-${background}`,
    criterion,
    threshold,
  }));
}

/**
 * Builds the WCAG contrast pairs the bundle contract enforces per bundle.
 * Bundles that host a form input add their fill as a second surface; card
 * bundles (everything except base) add a border/base-bg adjacency check
 * because their border touches the page surface; base adds its subtle-text
 * slot.
 */
export function pairsForBundle(bundle: Bundle): ContrastPair[] {
  const pairs = specPairs(bundle, BUNDLE_SPECS);
  if (INPUT_FILL_BUNDLES.includes(bundle)) {
    pairs.push(...specPairs(bundle, INPUT_FILL_SPECS));
  }
  if (CARD_BUNDLES.includes(bundle)) {
    pairs.push({
      label: 'border / base-bg',
      foreground: `--${bundle}-border`,
      background: '--base-bg',
      criterion: '1.4.11',
      threshold: 3,
    });
  }
  if (bundle === 'base') {
    pairs.push({
      label: 'subtle-text / bg',
      foreground: '--base-subtle-text',
      background: '--base-bg',
      criterion: '1.4.3',
      threshold: 4.5,
    });
  }
  return pairs;
}

/**
 * The focus-ring pairs, surfaced as a synthetic "focus" group so they appear
 * in the live checker alongside the bundle pairs (a11y brief B3). The focus
 * ring is a universal chrome token, not a per-bundle slot, so it is grouped
 * on its own rather than nested under a bundle.
 */
export function focusRingPairs(): ContrastPair[] {
  return FOCUS_RING_SURFACES.map((surface) => ({
    label: surface.label,
    foreground: '--focus-ring',
    background: surface.background,
    criterion: '1.4.11',
    threshold: 3,
  }));
}
