import { useMemo } from 'react';
import {
  BUNDLES,
  CARD_BUNDLES,
  VAR_GROUPS,
  type Bundle,
  type ThemeVariable,
} from './useThemeOverrides';

/**
 * Shared WCAG contrast computation for the theme editor's live contract
 * checking. Extracted so both `ContrastChecker` (the visible per-bundle
 * breakdown) and `ThemeSaveBar` (the failing-count warning at the Save
 * action) read a SINGLE source of truth – the a11y brief B5 mandates the
 * Save warning reuse ContrastChecker's computed failing count rather than
 * recomputing it, so the two can never disagree.
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

export const SC_LABELS: Record<ContrastPair['criterion'], string> = {
  '1.4.3': 'SC 1.4.3 Contrast (Minimum)',
  '1.4.11': 'SC 1.4.11 Non-text Contrast',
};

/**
 * The bundle background slots a focused element can sit on. The focus ring
 * (`--focus-ring`) must clear 3:1 against each (SC 1.4.11 / SC 2.4.13) – the
 * same surfaces the static `bundles.contrast.test.ts` suite enforces. The
 * editor checks the three highest-frequency chrome surfaces (page, card,
 * menu); the static suite covers the remaining state-bundle bgs, which use
 * alpha composites the runtime hex math cannot resolve. For the Custom theme
 * `--focus-ring` is now an editable, injected token (W1), so these pairs
 * resolve from live `colorValues` like any other slot instead of reading
 * "unverified".
 */
const FOCUS_RING_SURFACES: ReadonlyArray<{
  label: string;
  background: string;
}> = [
  { label: 'focus-ring / base-bg', background: '--base-bg' },
  { label: 'focus-ring / mount-bg', background: '--mount-bg' },
  { label: 'focus-ring / orbit-bg', background: '--orbit-bg' },
];

/**
 * Builds the WCAG contrast pairs the bundle contract enforces per bundle.
 * Card bundles (everything except base) add a border/base-bg adjacency check
 * because their border touches the page surface; base adds its subtle-text
 * slot.
 */
export function pairsForBundle(bundle: Bundle): ContrastPair[] {
  const pairs: ContrastPair[] = [
    {
      label: 'text / bg',
      foreground: `--${bundle}-text`,
      background: `--${bundle}-bg`,
      criterion: '1.4.3',
      threshold: 4.5,
    },
    {
      label: 'alt-text / bg',
      foreground: `--${bundle}-alt-text`,
      background: `--${bundle}-bg`,
      criterion: '1.4.3',
      threshold: 4.5,
    },
    {
      label: 'border / bg',
      foreground: `--${bundle}-border`,
      background: `--${bundle}-bg`,
      criterion: '1.4.11',
      threshold: 3,
    },
    {
      label: 'highlight / bg',
      foreground: `--${bundle}-highlight`,
      background: `--${bundle}-bg`,
      criterion: '1.4.11',
      threshold: 3,
    },
    {
      label: 'hl-fg / hl',
      foreground: `--${bundle}-highlight-fg`,
      background: `--${bundle}-highlight`,
      criterion: '1.4.3',
      threshold: 4.5,
    },
    {
      label: 'hl-fg / hl-hover',
      foreground: `--${bundle}-highlight-fg`,
      background: `--${bundle}-highlight-hover`,
      criterion: '1.4.3',
      threshold: 4.5,
    },
  ];
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

/**
 * Converts a single 8-bit sRGB channel value (0–1) to its linear light
 * equivalent, as specified by the WCAG 2.1 relative luminance formula.
 */
function linearizeColorComponent(component: number): number {
  return component <= 0.03928
    ? component / 12.92
    : Math.pow((component + 0.055) / 1.055, 2.4);
}

/**
 * Computes the WCAG 2.1 relative luminance of a hex color string.
 * Supports 3-digit and 6-digit hex (with or without `#`).
 * Returns `null` if the input is not a parseable hex color.
 */
function hexToRelativeLuminance(hex: string): number | null {
  const clean = hex.replace('#', '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((character) => character + character)
          .join('')
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;

  const redComponent = parseInt(expanded.substring(0, 2), 16) / 255;
  const greenComponent = parseInt(expanded.substring(2, 4), 16) / 255;
  const blueComponent = parseInt(expanded.substring(4, 6), 16) / 255;

  return (
    0.2126 * linearizeColorComponent(redComponent) +
    0.7152 * linearizeColorComponent(greenComponent) +
    0.0722 * linearizeColorComponent(blueComponent)
  );
}

/**
 * Computes the WCAG 2.1 contrast ratio between two hex colors. Returns `null`
 * if either color is invalid or uses alpha (alpha tokens require composite
 * math the runtime editor does not perform – the compiled bundle tests in
 * `bundles.contrast.test.ts` cover those rigorously).
 */
export function computeContrastRatio(
  hexA: string,
  hexB: string,
): number | null {
  const luminanceA = hexToRelativeLuminance(hexA);
  const luminanceB = hexToRelativeLuminance(hexB);
  if (luminanceA === null || luminanceB === null) return null;
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface GroupResult {
  /** A bundle id, or the synthetic `'focus'` group id. */
  group: Bundle | 'focus';
  label: string;
  pairs: Array<{ pair: ContrastPair; ratio: number | null }>;
  /** Pairs whose ratio resolved AND fell below threshold. */
  failureCount: number;
  /** Pairs whose ratio could not be computed (alpha / unset token). */
  unverifiedCount: number;
  /** Pairs whose ratio resolved (verified, pass or fail). */
  totalCount: number;
}

export interface ContrastResults {
  groups: GroupResult[];
  totalFailures: number;
  /** Total pairs that could not be verified across all groups. */
  totalUnverified: number;
  totalPairs: number;
}

/**
 * A single token's worst FAILING contrast pair, used by `ColorEditor` to
 * surface per-row failure feedback on the hex input (BL1). Only failing pairs
 * (resolved ratio below threshold) produce an entry; passing and unverified
 * pairs do not, so a row only ever reports a concrete, color-independent
 * "fails contrast" note (SC 3.3.1, SC 1.4.1).
 */
export interface TokenContrastFailure {
  /** Measured ratio of the failing pair. */
  ratio: number;
  /** Threshold the pair must clear. */
  threshold: number;
  /** Human-readable label for the pair (e.g. "text / bg"). */
  pairLabel: string;
}

/**
 * Builds a map from each token (a pair's FOREGROUND variable) to its worst
 * failing pair – the one furthest below threshold. Tokens that appear as a
 * foreground in several pairs (e.g. the focus ring across three bgs) report
 * their single most severe failure so the row note stays focused.
 */
export function tokenContrastFailures(
  results: ContrastResults,
): Map<string, TokenContrastFailure> {
  const failures = new Map<string, TokenContrastFailure>();
  for (const group of results.groups) {
    for (const { pair, ratio } of group.pairs) {
      if (ratio === null || ratio >= pair.threshold) continue;
      const deficit = pair.threshold - ratio;
      const existing = failures.get(pair.foreground);
      if (existing && existing.threshold - existing.ratio >= deficit) continue;
      failures.set(pair.foreground, {
        ratio,
        threshold: pair.threshold,
        pairLabel: pair.label,
      });
    }
  }
  return failures;
}

/**
 * Like `tokenContrastFailures`, but keys each failing pair under BOTH its
 * foreground AND its background token, so a token that fails only as a
 * BACKGROUND (e.g. a too-light `--mount-bg` under card text) still reports a
 * failure. Used by the knobs (whose representative token is often a background)
 * so a contrast problem surfaces ON THE KNOB rather than being buried in the
 * drawer. Reuses the ratios already computed by `useContrastResults` — it makes
 * NO new `computeContrastRatio` calls — so coverage stays identical to the
 * foreground-keyed view, just regrouped by both endpoints.
 */
export function pairsTouchingToken(
  results: ContrastResults,
): Map<string, TokenContrastFailure> {
  const failures = new Map<string, TokenContrastFailure>();
  const consider = (token: string, ratio: number, pair: ContrastPair) => {
    const deficit = pair.threshold - ratio;
    const existing = failures.get(token);
    if (existing && existing.threshold - existing.ratio >= deficit) return;
    failures.set(token, {
      ratio,
      threshold: pair.threshold,
      pairLabel: pair.label,
    });
  };
  for (const group of results.groups) {
    for (const { pair, ratio } of group.pairs) {
      if (ratio === null || ratio >= pair.threshold) continue;
      consider(pair.foreground, ratio, pair);
      consider(pair.background, ratio, pair);
    }
  }
  return failures;
}

/**
 * Resolves the value for a contrast pair endpoint from the editor's live
 * `colorValues`. `--focus-ring` is now an editable, injected token (W1), so it
 * is looked up here like any bundle slot. Returns an empty string for any
 * unresolved token so `computeContrastRatio` reports it as unverified ("–")
 * rather than throwing.
 */
function resolveValue(
  variable: string,
  colorValues: Record<ThemeVariable, string>,
): string {
  return colorValues[variable as ThemeVariable] ?? '';
}

/**
 * Computes WCAG contrast results for every bundle's contract pairs plus the
 * focus-ring pairs. Memoized on `colorValues` so live edits trigger a single
 * recompute. The focus ring is read from `colorValues` like any other token
 * now that it is editable for the Custom theme (W1).
 */
export function useContrastResults(
  colorValues: Record<ThemeVariable, string>,
): ContrastResults {
  return useMemo(() => {
    const bundleGroups: GroupResult[] = BUNDLES.map((bundle) => {
      const pairs = pairsForBundle(bundle).map((pair) => ({
        pair,
        ratio: computeContrastRatio(
          resolveValue(pair.foreground, colorValues),
          resolveValue(pair.background, colorValues),
        ),
      }));
      return buildGroup(bundle, labelFor(bundle), pairs);
    });

    const focusPairs = focusRingPairs().map((pair) => ({
      pair,
      ratio: computeContrastRatio(
        resolveValue(pair.foreground, colorValues),
        resolveValue(pair.background, colorValues),
      ),
    }));
    const focusGroup = buildGroup('focus', 'Focus ring', focusPairs);

    const groups = [...bundleGroups, focusGroup];
    return {
      groups,
      totalFailures: groups.reduce((sum, item) => sum + item.failureCount, 0),
      totalUnverified: groups.reduce(
        (sum, item) => sum + item.unverifiedCount,
        0,
      ),
      totalPairs: groups.reduce((sum, item) => sum + item.pairs.length, 0),
    };
  }, [colorValues]);
}

function labelFor(bundle: Bundle): string {
  return VAR_GROUPS.find((group) => group.bundle === bundle)?.label ?? bundle;
}

function buildGroup(
  group: Bundle | 'focus',
  label: string,
  pairs: Array<{ pair: ContrastPair; ratio: number | null }>,
): GroupResult {
  return {
    group,
    label,
    pairs,
    failureCount: pairs.filter(
      ({ pair, ratio }) => ratio !== null && ratio < pair.threshold,
    ).length,
    unverifiedCount: pairs.filter(({ ratio }) => ratio === null).length,
    totalCount: pairs.filter(({ ratio }) => ratio !== null).length,
  };
}
