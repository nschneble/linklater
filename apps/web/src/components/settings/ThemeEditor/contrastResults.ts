import { BUNDLES, VAR_GROUPS, type Bundle } from './useThemeOverrides';
import { evaluatePair } from './contrastResults.evaluate';
import { focusRingPairs, pairsForBundle } from './contrastResults.pairs';
import { useMemo } from 'react';
import type { ContrastPair } from './contrastResults.pairs';
import type { ThemeVariable } from './useThemeOverrides';

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
 *
 * The pair list lives in `contrastResults.pairs`, the note wording in
 * `contrastResults.notes`, and the measurement itself in
 * `contrastResults.evaluate`. What is left here is the roll-up: run every pair
 * through the evaluator and reduce the results to one verdict.
 */

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
 *
 * This reduction is only as honest as the parse it rests on, which is why
 * `theme/colorMath` refuses a value it cannot read rather than returning a
 * plausible one. A ratio that is not a number loses no comparison, so it
 * arrives here as a pair that neither failed nor went unmeasured, and the
 * palette rolls up clean.
 */
export function resolveContrastStatus(
  results: ContrastResults,
): ContrastStatus {
  if (results.totalFailures > 0) return 'fail';
  if (results.totalUnverified > 0) return 'uncheckable';
  return 'pass';
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
