/*
 * Tests for the live contrast math behind the Theme Editor's contract checker.
 *
 * `computeContrastRatio` is the WCAG 2.1 ratio used to flag failing pairs;
 * `pairsForBundle` is the per-bundle contract pair set. A superset assertion
 * mechanizes that the runtime pair set can never drift below the static
 * `bundles.contrast.test.ts` contract (the two sources must agree).
 */

import { describe, expect, it } from 'vitest';
import {
  computeContrastRatio,
  drawerOnlyFailureCount,
  focusRingPairs,
  KNOB_TOKENS,
  pairsForBundle,
  pairsTouchingToken,
  tokenContrastFailures,
} from './contrastResults';
import type { ContrastPair, ContrastResults } from './contrastResults';
import { BUNDLES, EDITABLE_VARS } from './useThemeOverrides';

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

/*
 * The static `bundles.contrast.test.ts` CONTRACT, mirrored here as slot
 * fg/bg/threshold triples. The superset assertion below proves the runtime
 * `pairsForBundle` set covers every static contract pair for every bundle, so
 * the live editor checker can never silently omit a contract the compiled
 * suite enforces. Keep this list in sync with the static CONTRACT.
 */
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

describe('tokenContrastFailures worst-failure selection', () => {
  it('keeps the failure with the larger deficit when one token fails two pairs of different thresholds', () => {
    // Same foreground token in two failing pairs with DIFFERENT thresholds.
    // Pair A: ratio 2.6 vs threshold 3 → deficit 0.4 (the milder failure).
    // Pair B: ratio 4.0 vs threshold 4.5 → deficit 0.5 (the worse failure).
    // The worse failure (B) must win regardless of pair order.
    const milder = makePair({
      label: 'token / border',
      criterion: '1.4.11',
      threshold: 3,
    });
    const worse = makePair({
      label: 'token / text',
      criterion: '1.4.3',
      threshold: 4.5,
    });
    const results: ContrastResults = {
      groups: [
        {
          bundle: 'mount',
          label: 'mount',
          pairs: [
            { pair: milder, ratio: 2.6 },
            { pair: worse, ratio: 4.0 },
          ],
        },
      ],
    } as unknown as ContrastResults;

    const failure = tokenContrastFailures(results).get('--token');
    expect(failure?.pairLabel).toBe('token / text');
    expect(failure?.ratio).toBe(4.0);
    expect(failure?.threshold).toBe(4.5);
  });
});

describe('pairsTouchingToken keys failures by BOTH endpoints', () => {
  it('reports a failure under the background token, not just the foreground', () => {
    // A too-light `--mount-bg` makes "text / bg" fail; the knob whose
    // representative token is `--mount-bg` must see it even though it is the
    // background, never the foreground.
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
    // Both endpoints carry the failure…
    expect(touching.get('--mount-text')?.ratio).toBe(2.8);
    expect(touching.get('--mount-bg')?.ratio).toBe(2.8);
    // …whereas the foreground-keyed view omits the background token.
    expect(tokenContrastFailures(results).get('--mount-bg')).toBeUndefined();
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

/*
 * C1 COMPLETENESS INVARIANT — the standalone contrast card is gone, so every
 * failing pair must remain reachable inline. An edit to token X can only change
 * pairs that TOUCH X, so surfacing each pair on BOTH endpoints guarantees the
 * note lands on whichever control the user just edited. This mechanizes that no
 * failing pair can fall through the three surfacing channels:
 *   (a) a KNOB note     — either endpoint is one of the nine knob tokens
 *   (b) a DRAWER-ROW note — either endpoint is an editable token (every editable
 *       token renders a drawer row, and the rows read the both-endpoints map)
 *   (c) the TOGGLE BADGE — pairs with neither endpoint a knob ("drawer-only")
 */
describe('C1: every failing pair self-reports inline (card retired)', () => {
  const editable = new Set<string>(EDITABLE_VARS);

  it('surfaces every contract pair via a knob note or a drawer-row note', () => {
    // A pair with no inline home would land here as a `false` keyed by its
    // endpoints, localizing the regression.
    const unhomed = allContractPairs().filter((pair) => {
      const endpoints = [pair.foreground, pair.background];
      const knobNote = endpoints.some((token) => KNOB_TOKENS.has(token));
      const drawerRowNote = endpoints.some((token) => editable.has(token));
      return !(knobNote || drawerRowNote);
    });
    expect(
      unhomed.map((pair) => `${pair.foreground} / ${pair.background}`),
    ).toEqual([]);
  });

  it('keeps BOTH endpoints of every contract pair editable, so editing either self-reports (C3)', () => {
    // Any endpoint that is not an editable drawer row surfaces here by name.
    const nonEditableEndpoints = allContractPairs().flatMap((pair) =>
      [pair.foreground, pair.background].filter(
        (token) => !editable.has(token),
      ),
    );
    expect(nonEditableEndpoints).toEqual([]);
  });

  it('routes pairs with no knob endpoint to the drawer (badge advertises them)', () => {
    const touching = pairsTouchingToken(allFailing());
    for (const pair of allContractPairs()) {
      const endpoints = [pair.foreground, pair.background];
      if (endpoints.some((token) => KNOB_TOKENS.has(token))) continue;
      // Drawer-only: each endpoint must still carry the failure in the
      // both-endpoints map (so its drawer row shows the note) and be editable.
      for (const token of endpoints) {
        expect(touching.has(token)).toBe(true);
        expect(editable.has(token)).toBe(true);
      }
    }
  });
});

describe('drawerOnlyFailureCount', () => {
  it('counts only failing pairs whose neither endpoint is a knob token', () => {
    const knobPair = makePair({
      label: 'text / bg',
      foreground: '--mount-text', // a knob token
      background: '--mount-bg',
      threshold: 4.5,
    });
    const drawerPair = makePair({
      label: 'hl-fg / hl',
      foreground: '--alert-highlight-fg', // neither is a knob token
      background: '--alert-highlight',
      threshold: 4.5,
    });
    const passingDrawerPair = makePair({
      label: 'border / bg',
      foreground: '--warn-border',
      background: '--warn-bg',
      criterion: '1.4.11',
      threshold: 3,
    });
    const results = {
      groups: [
        {
          group: 'mount',
          label: 'mount',
          pairs: [
            { pair: knobPair, ratio: 2 }, // failing but knob-touching → excluded
            { pair: drawerPair, ratio: 2 }, // failing, drawer-only → counted
            { pair: passingDrawerPair, ratio: 9 }, // passing → excluded
          ],
        },
      ],
    } as unknown as ContrastResults;
    expect(drawerOnlyFailureCount(results)).toBe(1);
  });

  it('ignores unverified (null-ratio) pairs', () => {
    const drawerPair = makePair({
      foreground: '--info-text',
      background: '--info-bg',
    });
    const results = {
      groups: [
        {
          group: 'info',
          label: 'info',
          pairs: [{ pair: drawerPair, ratio: null }],
        },
      ],
    } as unknown as ContrastResults;
    expect(drawerOnlyFailureCount(results)).toBe(0);
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
