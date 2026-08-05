/*
 * Tests for the live contrast math behind the Theme Editor's contract checker.
 *
 * `computeContrastRatio` is the WCAG 2.1 ratio used to flag failing pairs;
 * `pairsForBundle` is the per-bundle contract pair set. A superset assertion
 * mechanizes that the runtime pair set can never drift below the static
 * `bundles.contrast.test.ts` contract (the two sources must agree).
 */

import { BUNDLES, EDITABLE_VARS, VAR_GROUPS } from './useThemeOverrides';
import {
  computeContrastRatio,
  focusRingPairs,
  pairsForBundle,
  pairsTouchingToken,
  resolveContrastStatus,
  useContrastResults,
} from './contrastResults';
import { describe, expect, it } from 'vitest';
import { evaluatePair } from './contrastResults.evaluate';
import { renderHook } from '@testing-library/react';
import type { ContrastPair, ContrastResults } from './contrastResults';

/** Every contract pair the live checker evaluates: per-bundle plus focus ring. */
function allContractPairs(): ContrastPair[] {
  return [
    ...BUNDLES.flatMap((bundle) => pairsForBundle(bundle)),
    ...focusRingPairs(),
  ];
}

/** A ContrastResults where EVERY contract pair is failing (ratio below its
 *  threshold), so the completeness assertions see the worst case. */
function allFailing(): ContrastResults {
  const pairs = allContractPairs().map((pair) => ({ pair, ratio: 1 }));
  return {
    groups: [
      {
        group: 'base',
        label: 'base',
        pairs,
        failureCount: pairs.length,
        unverifiedCount: 0,
        totalCount: pairs.length,
      },
    ],
    totalFailures: pairs.length,
    totalUnverified: 0,
  } as unknown as ContrastResults;
}

function makePair(overrides: Partial<ContrastPair>): ContrastPair {
  return {
    label: 'pair',
    foreground: '--token',
    background: '--bg',
    criterion: '1.4.3',
    threshold: 4.5,
    ...overrides,
  };
}

/**
 * A palette where every contract pair passes: backgrounds white, foregrounds
 * black, and the highlight slots a grey squeezed between two thresholds. The
 * highlight has to clear 4.5:1 against a black highlight-fg AND 3:1 against a
 * white background, which pins its relative luminance to roughly 0.175-0.3.
 * `#7c7c7c` sits at 0.2015, giving 5.03 and 4.18.
 */
function passingPalette(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const variable of EDITABLE_VARS) {
    if (variable.endsWith('-bg')) {
      values[variable] = '#ffffff';
    } else if (
      variable.endsWith('-highlight') ||
      variable.endsWith('-highlight-hover')
    ) {
      values[variable] = '#7c7c7c';
    } else {
      values[variable] = '#000000';
    }
  }
  return values;
}

describe('resolveContrastStatus', () => {
  it.each([
    ['fail', 3, 2],
    ['fail', 1, 0],
    ['uncheckable', 0, 5],
    ['pass', 0, 0],
  ])(
    'is %s for %i failures and %i unverified',
    (status, failures, unverified) => {
      expect(
        resolveContrastStatus({
          groups: [],
          totalFailures: failures,
          totalUnverified: unverified,
        } as unknown as ContrastResults),
      ).toBe(status);
    },
  );

  it('reports a measured failure ahead of an unmeasurable pair', () => {
    // a real number the user can act on beats "we could not tell"
    expect(
      resolveContrastStatus({
        groups: [],
        totalFailures: 1,
        totalUnverified: 9,
      } as unknown as ContrastResults),
    ).toBe('fail');
  });
});

describe('an unmeasurable pair is never rolled up as passing', () => {
  it('passes only when every pair actually resolved', () => {
    const { result } = renderHook(() => useContrastResults(passingPalette()));

    expect(result.current.totalUnverified).toBe(0);
    expect(resolveContrastStatus(result.current)).toBe('pass');
  });

  it('measures a translucent card instead of skipping it', () => {
    // the shipped dark seed shape. These pairs used to resolve to null and be
    // skipped, which is what let the editor claim conformance over them.
    // Composited over an opaque page they are ordinary measurable colors.
    const palette = { ...passingPalette(), '--mount-bg': '#ffffff0d' };

    const { result } = renderHook(() => useContrastResults(palette));

    expect(result.current.totalUnverified).toBe(0);
    expect(resolveContrastStatus(result.current)).toBe('pass');
  });

  it('catches a translucent card that composites into a failure', () => {
    // near-transparent black over a white page lands close to white, so black
    // text still passes but a mid-grey highlight no longer clears 3:1
    const palette = {
      ...passingPalette(),
      '--mount-bg': '#0000000d',
      '--mount-highlight': '#f0f0f0',
    };

    const { result } = renderHook(() => useContrastResults(palette));

    expect(result.current.totalFailures).toBeGreaterThan(0);
    expect(resolveContrastStatus(result.current)).toBe('fail');
  });

  it('still refuses to claim conformance when the page itself is translucent', () => {
    // --base-bg is the root of every chain, so there is nothing behind it to
    // composite against and no honest number to report
    const palette = { ...passingPalette(), '--base-bg': '#ffffff0d' };

    const { result } = renderHook(() => useContrastResults(palette));

    expect(result.current.totalUnverified).toBeGreaterThan(0);
    expect(resolveContrastStatus(result.current)).toBe('uncheckable');
  });
});

/**
 * C1, restated for compositing.
 *
 * The old invariant was "an edit to token X can only change pairs X is an
 * ENDPOINT of", which held only because nothing else was ever read. Once a
 * backdrop participates, editing `--base-bg` moves `--mount-text / --mount-bg`,
 * a pair that names neither.
 *
 * The general property is: the ratio of a pair is a pure function of the
 * tokens the computation actually CONSUMED, so an edit to X can only move
 * pairs where X is in `reads(p)`. The word doing the work is "actually" —
 * compositing short-circuits on the first opaque backdrop, so on an opaque
 * palette `reads(p)` is exactly the two endpoints and keying is unchanged.
 *
 * This is a differential test rather than a structural one: it perturbs each
 * token in turn and checks that everything which moved had declared it. That
 * is the assertion the original bug would have failed.
 */
describe('C1 differential: only pairs that READ a token move when it changes', () => {
  const allPairs = allContractPairs();

  // a translucent card, so backdrops genuinely participate; on an all-opaque
  // palette this test would pass vacuously
  const palette = { ...passingPalette(), '--mount-bg': '#ffffff26' };

  function evaluateAll(values: Record<string, string>) {
    const resolve = (token: string) => values[token] ?? '';
    return allPairs.map((pair) =>
      evaluatePair(pair.foreground, pair.background, resolve),
    );
  }

  it.each(EDITABLE_VARS.map((variable) => [variable]))(
    'editing %s moves only pairs that read it',
    (variable) => {
      const baseline = evaluateAll(palette);
      // a value far from the original, so any real dependency shows up
      const perturbed = evaluateAll({ ...palette, [variable]: '#ff00ff' });

      const movedWithoutReading = baseline.flatMap((before, index) => {
        if (before.ratio === perturbed[index].ratio) return [];
        if (before.reads.has(variable)) return [];
        return [allPairs[index].label];
      });

      expect(movedWithoutReading).toEqual([]);
    },
  );

  it('reads exactly the two endpoints when nothing is translucent', () => {
    const opaque = passingPalette();
    const resolve = (token: string) => opaque[token] ?? '';

    for (const pair of allPairs) {
      const evaluation = evaluatePair(
        pair.foreground,
        pair.background,
        resolve,
      );
      expect([...evaluation.reads].sort()).toEqual(
        [pair.foreground, pair.background].sort(),
      );
    }
  });
});

describe('computeContrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(computeContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(computeContrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('expands 3-digit hex before computing', () => {
    expect(computeContrastRatio('#abc', '#aabbcc')).toBeCloseTo(1, 5);
  });

  it('accepts hex with or without the leading #', () => {
    expect(computeContrastRatio('000000', 'ffffff')).toBeCloseTo(21, 5);
  });

  it('returns null for an invalid hex string', () => {
    expect(computeContrastRatio('not-a-color', '#ffffff')).toBeNull();
    expect(computeContrastRatio('#12', '#ffffff')).toBeNull();
  });

  it('returns null for rgba / alpha values (composite math not done here)', () => {
    expect(computeContrastRatio('rgb(0 0 0 / 0.5)', '#ffffff')).toBeNull();
    expect(computeContrastRatio('#00000080', '#ffffff')).toBeNull();
  });
});

describe('pairsForBundle', () => {
  it('adds the border/base-bg adjacency check for card bundles', () => {
    const labels = pairsForBundle('mount').map((pair) => pair.label);
    expect(labels).toContain('border / base-bg');
  });

  it('does NOT add border/base-bg for the base bundle', () => {
    const labels = pairsForBundle('base').map((pair) => pair.label);
    expect(labels).not.toContain('border / base-bg');
  });

  it('adds the subtle-text check only for the base bundle', () => {
    expect(pairsForBundle('base').map((pair) => pair.label)).toContain(
      'subtle-text / bg',
    );
    expect(pairsForBundle('orbit').map((pair) => pair.label)).not.toContain(
      'subtle-text / bg',
    );
  });
});

// mirrors the static bundles.contrast.test.ts contract; keep the two in sync
const STATIC_CONTRACT: ReadonlyArray<{
  fg: string;
  bg: string;
  threshold: number;
}> = [
  { fg: 'text', bg: 'bg', threshold: 4.5 },
  { fg: 'alt-text', bg: 'bg', threshold: 4.5 },
  { fg: 'border', bg: 'bg', threshold: 3 },
  { fg: 'highlight', bg: 'bg', threshold: 3 },
  { fg: 'highlight-fg', bg: 'highlight', threshold: 4.5 },
  { fg: 'highlight-fg', bg: 'highlight-hover', threshold: 4.5 },
];

describe('pairsTouchingToken keys failures by BOTH endpoints', () => {
  it('reports a failure under the background token, not just the foreground', () => {
    // a too-light `--mount-bg` fails "text / bg"; the bg token's row must see it too
    const pair = makePair({
      label: 'text / bg',
      foreground: '--mount-text',
      background: '--mount-bg',
      criterion: '1.4.3',
      threshold: 4.5,
    });
    const results: ContrastResults = {
      groups: [
        {
          bundle: 'mount',
          label: 'mount',
          pairs: [{ pair, ratio: 2.8 }],
        },
      ],
    } as unknown as ContrastResults;

    const touching = pairsTouchingToken(results);
    // both endpoints carry the failure, including the bg token a fg-only view omits
    expect(touching.get('--mount-text')?.ratio).toBe(2.8);
    expect(touching.get('--mount-bg')?.ratio).toBe(2.8);
  });

  it('keeps the WORST-deficit failure when two pairs share an endpoint', () => {
    // `--mount-bg` is shared by two failing pairs; report the worst deficit, any order
    const mildPair = makePair({
      label: 'border / bg',
      foreground: '--mount-border',
      background: '--mount-bg',
      criterion: '1.4.11',
      threshold: 3,
    });
    const severePair = makePair({
      label: 'text / bg',
      foreground: '--mount-text',
      background: '--mount-bg',
      criterion: '1.4.3',
      threshold: 4.5,
    });
    const results: ContrastResults = {
      groups: [
        {
          bundle: 'mount',
          label: 'mount',
          // mild deficit 3 - 2.6 = 0.4; severe deficit 4.5 - 1.5 = 3.0
          pairs: [
            { pair: mildPair, ratio: 2.6 },
            { pair: severePair, ratio: 1.5 },
          ],
        },
      ],
    } as unknown as ContrastResults;

    const touching = pairsTouchingToken(results);
    // the `--mount-bg` row shows the severe pair; same-bundle partner = bare slot name
    expect(touching.get('--mount-bg')?.partnerLabel).toBe('Text');
    expect(touching.get('--mount-bg')?.ratio).toBe(1.5);
  });

  it('bundle-qualifies a partner that lives in a different bundle', () => {
    // cross-bundle endpoints need bundle-qualified partner labels (SC 3.3.1)
    const crossBundle = makePair({
      label: 'border / base-bg',
      foreground: '--mount-border',
      background: '--base-bg',
      criterion: '1.4.11',
      threshold: 3,
    });
    const results: ContrastResults = {
      groups: [
        {
          bundle: 'mount',
          label: 'mount',
          pairs: [{ pair: crossBundle, ratio: 2.1 }],
        },
      ],
    } as unknown as ContrastResults;

    const touching = pairsTouchingToken(results);
    expect(touching.get('--mount-border')?.partnerLabel).toBe(
      'Base background',
    );
    expect(touching.get('--base-bg')?.partnerLabel).toBe('Mount border');
  });

  it('makes no entry for passing or unverified pairs', () => {
    const passing = makePair({ foreground: '--a', background: '--b' });
    const unverified = makePair({ foreground: '--c', background: '--d' });
    const results: ContrastResults = {
      groups: [
        {
          bundle: 'mount',
          label: 'mount',
          pairs: [
            { pair: passing, ratio: 7 },
            { pair: unverified, ratio: null },
          ],
        },
      ],
    } as unknown as ContrastResults;

    const touching = pairsTouchingToken(results);
    expect(touching.size).toBe(0);
  });
});

// C1: every contract-pair endpoint must be an editable slot row, so none fall through
describe('C1 premise: every slot row is an editable token (VAR_GROUPS ⇄ EDITABLE_VARS)', () => {
  it('renders exactly one slot row per editable token, no more no less', () => {
    // EDITABLE_VARS and VAR_GROUPS build independently; this locks them equal both ways
    const slotRows = new Set(
      VAR_GROUPS.flatMap((group) => group.items.map((item) => item.variable)),
    );
    expect(slotRows).toEqual(new Set(EDITABLE_VARS));
  });
});

describe('C1: every failing pair self-reports inline (card retired)', () => {
  const editable = new Set<string>(EDITABLE_VARS);

  it('keeps BOTH endpoints of every contract pair editable, so editing either self-reports (C3)', () => {
    // any endpoint that is not an editable slot row surfaces here by name
    const nonEditableEndpoints = allContractPairs().flatMap((pair) =>
      [pair.foreground, pair.background].filter(
        (token) => !editable.has(token),
      ),
    );
    expect(nonEditableEndpoints).toEqual([]);
  });

  it('keys every failing pair under BOTH endpoints, so each slot row shows the note', () => {
    const touching = pairsTouchingToken(allFailing());
    for (const pair of allContractPairs()) {
      for (const token of [pair.foreground, pair.background]) {
        expect(touching.has(token)).toBe(true);
        expect(editable.has(token)).toBe(true);
      }
    }
  });
});

describe('runtime pair set ⊇ static bundles.contrast.test.ts contract', () => {
  for (const bundle of BUNDLES) {
    it(`covers every static contract pair for ${bundle}`, () => {
      const runtimePairs = pairsForBundle(bundle);
      for (const contract of STATIC_CONTRACT) {
        const match = runtimePairs.find(
          (pair) =>
            pair.foreground === `--${bundle}-${contract.fg}` &&
            pair.background === `--${bundle}-${contract.bg}`,
        );
        expect(match).toBeDefined();
        expect(match?.threshold).toBe(contract.threshold);
      }
    });
  }
});
