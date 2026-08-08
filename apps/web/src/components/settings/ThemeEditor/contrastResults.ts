import {
  BUNDLES,
  CARD_BUNDLES,
  VAR_GROUPS,
  type Bundle,
  type ThemeVariable,
} from './useThemeOverrides';
import { contrastRatio } from '../../../theme/colorMath';
import { evaluatePair } from './contrastResults.evaluate';
import { useMemo } from 'react';
import type { Rgb } from '../../../theme/colorMath';

/**
 * Shared WCAG contrast computation for the theme editor's live contract
 * checking. The standalone contrast card AND the aggregate pass/fail chip were
 * retired: every failing pair now self-reports inline ON the slot row being
 * edited. The rows all read this SINGLE source of truth so they can never
 * disagree.
 *
 * The governing invariant (C1): a pair's ratio is a pure function of the
 * tokens the measurement actually CONSUMED, so an edit to token X can only
 * move pairs where X is among them. Surfacing each failing pair on every
 * token it read guarantees the warning lands on whichever slot row the user
 * just edited.
 *
 * "Consumed" rather than "declared" is what keeps this tight. Compositing
 * stops at the first opaque backdrop, so on an opaque palette a pair reads
 * exactly its two endpoints and the keying is identical to the two-endpoint
 * rule this replaced. A backdrop only enters the picture when something above
 * it is genuinely translucent. `contrastResults.test.ts` mechanizes it
 * differentially: perturb each token, and assert everything that moved had
 * declared it.
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
 * Parses an OPAQUE hex color to its channels. Supports 3- and 6-digit hex,
 * with or without `#`, and rejects everything else including the 8-digit
 * alpha form: a translucent color has no luminance of its own, so there is
 * nothing honest to return for one here.
 */
function hexToRgb(hex: string): Rgb | null {
  const clean = hex.replace('#', '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((character) => character + character)
          .join('')
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;

  return [
    parseInt(expanded.substring(0, 2), 16),
    parseInt(expanded.substring(2, 4), 16),
    parseInt(expanded.substring(4, 6), 16),
  ];
}

/**
 * Computes the WCAG 2.1 contrast ratio between two OPAQUE hex colors, with no
 * compositing. Returns `null` if either color is invalid or carries alpha.
 *
 * This is NOT what the live checker measures with: `evaluatePair` composites
 * each background down its real render stack first. It survives as the
 * two-endpoint form the Randomize generator solves against
 * (`randomPalette.ts`), which is sound there because that generator emits only
 * opaque 6-digit hex, and on an opaque background compositing short-circuits
 * to exactly this. Feeding it a translucent value is a silent hole, so it
 * refuses rather than guessing.
 *
 * The ratio itself comes from `theme/colorMath`, the same module the static
 * bundle suites measure with, so the number shown to a user editing a theme
 * and the number CI enforces cannot drift apart.
 */
export function computeContrastRatio(
  hexA: string,
  hexB: string,
): number | null {
  const foreground = hexToRgb(hexA);
  const background = hexToRgb(hexB);
  if (foreground === null || background === null) return null;
  return contrastRatio(foreground, background);
}

/** One contract pair as measured across every place its background renders. */
export interface PairResult {
  pair: ContrastPair;
  /** Worst MEASURED ratio; null when no render site could be measured. */
  ratio: number | null;
  /** Tokens the measurement consumed; absent means just the two endpoints. */
  reads?: ReadonlySet<string>;
  /** Render sites that could not be measured; absent means none. */
  unmeasurable?: number;
}

/** Render sites of `entry` that could not be measured. */
function unmeasurableSites(entry: PairResult): number {
  if (entry.unmeasurable !== undefined) return entry.unmeasurable;
  return entry.ratio === null ? 1 : 0;
}

interface GroupResult {
  /** A bundle id, or the synthetic `'focus'` group id. */
  group: Bundle | 'focus';
  label: string;
  pairs: PairResult[];
  /** Pairs whose worst measured ratio fell below threshold. */
  failureCount: number;
  /** Pairs with at least one render site nothing could measure. */
  unverifiedCount: number;
  /** Pairs that measured somewhere (verified, pass or fail). */
  totalCount: number;
}

export interface ContrastResults {
  groups: GroupResult[];
  totalFailures: number;
  /** Pairs with an unmeasurable render site, across all groups. */
  totalUnverified: number;
}

/** What the title-row status icon reports about the palette as a whole. */
export type ContrastStatus = 'fail' | 'uncheckable' | 'pass';

/**
 * Rolls the whole palette up to one verdict.
 *
 * A pair whose ratio could not be computed is NOT a pass. Counting it as one
 * is how the editor came to announce "Theme colors meet minimum contrast"
 * over a palette with translucent backgrounds: every pair touching one
 * resolves to `null`, `pairsTouchingToken` skips it, and the roll-up saw zero
 * failures. That is a conformance claim about pairs nothing ever measured,
 * and a screen reader user has no other signal to go on.
 *
 * `unverifiedCount` was already computed for exactly this and had no reader.
 */
export function resolveContrastStatus(
  results: ContrastResults,
): ContrastStatus {
  if (results.totalFailures > 0) return 'fail';
  if (results.totalUnverified > 0) return 'uncheckable';
  return 'pass';
}

/**
 * A single token's worst FAILING contrast pair, used by the per-bundle slot
 * rows to surface failure feedback on the hex input (BL1). Only failing pairs
 * (resolved ratio below threshold) produce an entry; passing and unverified
 * pairs do not, so a row only ever reports a concrete, color-independent
 * "fails contrast" note (SC 3.3.1, SC 1.4.1).
 */
export interface TokenContrastFailure {
  /** Measured ratio of the failing pair. */
  ratio: number;
  /** Threshold the pair must clear. */
  threshold: number;
  /**
   * The OTHER endpoint of the failing pair, named by its editor row label
   * (e.g. "Alt text"). The row this failure renders on IS one endpoint, so the
   * note only needs to name its partner — the current slot is implied by the
   * row's own label + the input's accessible name. Bundle-qualified ("Mount
   * border") when the partner lives in a different bundle than this row, so the
   * named endpoint is never ambiguous across bundles.
   */
  partnerLabel: string;
}

/**
 * Per-endpoint descriptor for every editable token, built once from the same
 * `VAR_GROUPS` the rows render from, so a failure note names its partner with
 * the EXACT label the user sees on that partner's row. The universal focus ring
 * (`--focus-ring`) rides the base group but belongs to no bundle, so its
 * `bundle` is null (detected by its token not matching `--{group.bundle}-…`) —
 * it is never bundle-qualified since its name is already unique.
 */
const ENDPOINT_INFO: ReadonlyMap<
  string,
  { bundle: Bundle | null; bundleLabel: string; slotLabel: string }
> = (() => {
  const info = new Map<
    string,
    { bundle: Bundle | null; bundleLabel: string; slotLabel: string }
  >();
  for (const group of VAR_GROUPS) {
    for (const item of group.items) {
      const belongsToBundle = item.variable.startsWith(`--${group.bundle}-`);
      info.set(item.variable, {
        bundle: belongsToBundle ? group.bundle : null,
        bundleLabel: group.label,
        slotLabel: item.label,
      });
    }
  }
  return info;
})();

/**
 * The failing pair's OTHER endpoint, relative to `rowToken`, as a display
 * label. Bundle-qualified only when the partner's bundle differs from the row's
 * (or the row has no bundle, e.g. the focus ring) so "Background" can't be
 * mistaken for the wrong bundle's background.
 */
function partnerLabelFor(rowToken: string, pair: ContrastPair): string {
  const partnerToken =
    rowToken === pair.foreground ? pair.background : pair.foreground;
  const partner = ENDPOINT_INFO.get(partnerToken);
  if (partner === undefined) return partnerToken;
  const row = ENDPOINT_INFO.get(rowToken);
  if (partner.bundle !== null && partner.bundle !== row?.bundle) {
    return `${partner.bundleLabel} ${partner.slotLabel.toLowerCase()}`;
  }
  return partner.slotLabel;
}

/**
 * Keys each failing pair under every token its measurement READ, so a token
 * that fails only as a BACKGROUND (e.g. a too-light `--mount-bg` under card
 * text) still reports a failure on its OWN slot row, not only on the far
 * foreground row (C3). A backdrop the pair names nowhere, like `--base-bg`
 * under a translucent card, reports on its own row too. Reuses the
 * evaluations already computed by `useContrastResults`; it measures nothing
 * itself.
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
      partnerLabel: partnerLabelFor(token, pair),
    });
  };
  for (const group of results.groups) {
    for (const { pair, ratio, reads } of group.pairs) {
      if (ratio === null || ratio >= pair.threshold) continue;
      // every token the ratio READ can move it back over threshold, backdrops
      // included; on an opaque palette that is exactly the two endpoints
      for (const token of reads ?? [pair.foreground, pair.background]) {
        consider(token, ratio, pair);
      }
    }
  }
  return failures;
}

/**
 * Resolves the value for a contrast pair endpoint from the editor's live
 * `colorValues`. `--focus-ring` is now an editable, injected token (W1), so it
 * is looked up here like any bundle slot. Returns an empty string for any
 * unresolved token so `evaluatePair` reports that site as unverified ("–")
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
 * focus-ring pairs, each measured against every place its background really
 * renders and scored on the worst of them. Memoized on `colorValues` so live
 * edits trigger a single recompute. The focus ring is read from `colorValues`
 * like any other token now that it is editable for the Custom theme (W1).
 */
export function useContrastResults(
  colorValues: Record<ThemeVariable, string>,
): ContrastResults {
  return useMemo(() => {
    const resolve = (token: string) => resolveValue(token, colorValues);
    const measure = (pair: ContrastPair): PairResult => {
      const evaluation = evaluatePair(
        pair.foreground,
        pair.background,
        resolve,
      );
      return {
        pair,
        ratio: evaluation.ratio,
        reads: evaluation.reads,
        unmeasurable: evaluation.unmeasurable,
      };
    };

    const bundleGroups: GroupResult[] = BUNDLES.map((bundle) =>
      buildGroup(bundle, labelFor(bundle), pairsForBundle(bundle).map(measure)),
    );

    const focusPairs = focusRingPairs().map(measure);
    const focusGroup = buildGroup('focus', 'Focus ring', focusPairs);

    const groups = [...bundleGroups, focusGroup];
    return {
      groups,
      totalFailures: groups.reduce((sum, item) => sum + item.failureCount, 0),
      totalUnverified: groups.reduce(
        (sum, item) => sum + item.unverifiedCount,
        0,
      ),
    };
  }, [colorValues]);
}

function labelFor(bundle: Bundle): string {
  return VAR_GROUPS.find((group) => group.bundle === bundle)?.label ?? bundle;
}

function buildGroup(
  group: Bundle | 'focus',
  label: string,
  pairs: PairResult[],
): GroupResult {
  return {
    group,
    label,
    pairs,
    failureCount: pairs.filter(
      ({ pair, ratio }) => ratio !== null && ratio < pair.threshold,
    ).length,
    unverifiedCount: pairs.filter((entry) => unmeasurableSites(entry) > 0)
      .length,
    totalCount: pairs.filter(({ ratio }) => ratio !== null).length,
  };
}
