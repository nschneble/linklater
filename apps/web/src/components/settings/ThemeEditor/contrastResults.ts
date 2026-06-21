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
 * alpha composites the runtime hex math cannot resolve.
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
  failureCount: number;
  totalCount: number;
}

export interface ContrastResults {
  groups: GroupResult[];
  totalFailures: number;
  totalPairs: number;
}

/**
 * Resolves the value for a contrast pair endpoint. Bundle slots come from the
 * editor's live `colorValues`; `--focus-ring` is not an editable token (it is
 * not in `EDITABLE_VARS`), so it is read from the live computed style of the
 * document root instead. Returns an empty string for any unresolved token so
 * `computeContrastRatio` reports it as unverified ("–") rather than throwing.
 */
function resolveValue(
  variable: string,
  colorValues: Record<ThemeVariable, string>,
  focusRingValue: string,
): string {
  if (variable === '--focus-ring') return focusRingValue;
  return colorValues[variable as ThemeVariable] ?? '';
}

/**
 * Computes WCAG contrast results for every bundle's contract pairs plus the
 * focus-ring pairs. Memoized on its inputs so live edits trigger a single
 * recompute. `focusRingValue` is read by the caller from the live computed
 * style (the focus ring is not user-editable in this wave).
 */
export function useContrastResults(
  colorValues: Record<ThemeVariable, string>,
  focusRingValue: string,
): ContrastResults {
  return useMemo(() => {
    const bundleGroups: GroupResult[] = BUNDLES.map((bundle) => {
      const pairs = pairsForBundle(bundle).map((pair) => ({
        pair,
        ratio: computeContrastRatio(
          resolveValue(pair.foreground, colorValues, focusRingValue),
          resolveValue(pair.background, colorValues, focusRingValue),
        ),
      }));
      return buildGroup(bundle, labelFor(bundle), pairs);
    });

    const focusPairs = focusRingPairs().map((pair) => ({
      pair,
      ratio: computeContrastRatio(
        resolveValue(pair.foreground, colorValues, focusRingValue),
        resolveValue(pair.background, colorValues, focusRingValue),
      ),
    }));
    const focusGroup = buildGroup('focus', 'Focus ring', focusPairs);

    const groups = [...bundleGroups, focusGroup];
    return {
      groups,
      totalFailures: groups.reduce((sum, item) => sum + item.failureCount, 0),
      totalPairs: groups.reduce((sum, item) => sum + item.totalCount, 0),
    };
  }, [colorValues, focusRingValue]);
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
    totalCount: pairs.filter(({ ratio }) => ratio !== null).length,
  };
}
