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
  focusRingPairs,
  pairsForBundle,
  pairsTouchingToken,
} from './contrastResults';
import type { ContrastPair, ContrastResults } from './contrastResults';
import { BUNDLES, EDITABLE_VARS, VAR_GROUPS } from './useThemeOverrides';

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

describe('pairsTouchingToken keys failures by BOTH endpoints', () => {
  it('reports a failure under the background token, not just the foreground', () => {
    // A too-light `--mount-bg` makes "text / bg" fail; the slot row whose
    // token is `--mount-bg` must see it even though it is the background,
    // never the foreground.
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
    // Both endpoints carry the failure — including the background token, which
    // a foreground-only view would have omitted.
    expect(touching.get('--mount-text')?.ratio).toBe(2.8);
    expect(touching.get('--mount-bg')?.ratio).toBe(2.8);
  });

  it('keeps the WORST-deficit failure when two pairs share an endpoint', () => {
    // `--mount-bg` is the shared endpoint of two failing pairs. The note must
    // report the pair the token misses by the MOST (largest threshold − ratio),
    // so the row surfaces its hardest constraint — regardless of pair order.
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
          // mild deficit 3 − 2.6 = 0.4; severe deficit 4.5 − 1.5 = 3.0.
          pairs: [
            { pair: mildPair, ratio: 2.6 },
            { pair: severePair, ratio: 1.5 },
          ],
        },
      ],
    } as unknown as ContrastResults;

    const touching = pairsTouchingToken(results);
    // The shared `--mount-bg` row shows the severe pair (the bigger deficit),
    // even though the mild pair came first.
    expect(touching.get('--mount-bg')?.pairLabel).toBe('text / bg');
    expect(touching.get('--mount-bg')?.ratio).toBe(1.5);
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
 * failing pair must remain reachable inline. The editing surface is now a
 * bundle tablist whose panel renders one slot row per editable token; an edit
 * to token X can only change pairs that TOUCH X, so surfacing each pair on BOTH
 * endpoints (`pairsTouchingToken`) guarantees the note lands on whichever slot
 * row the user just edited. This mechanizes that no failing pair can fall
 * through: every contract-pair endpoint must be an editable token, i.e. it
 * renders a slot row under some bundle panel.
 */
describe('C1 premise: every slot row is an editable token (VAR_GROUPS ⇄ EDITABLE_VARS)', () => {
  it('renders exactly one slot row per editable token, no more no less', () => {
    // The C1 test asserts every contract-pair endpoint is in EDITABLE_VARS
    // ("has a slot row"), but the panels actually render rows from
    // VAR_GROUPS[].items. They are equal only by parallel construction —
    // EDITABLE_VARS flatMaps the slot arrays in customThemeTokens.ts while
    // VAR_GROUPS branches per-bundle in useThemeOverrides.ts, two independent
    // build-ups. This locks them in lockstep so a future VAR_GROUPS filter can't
    // silently drop a slot row while C1 stays green. The set equality is
    // bidirectional: a dropped row OR an extra editable token both fail.
    const slotRows = new Set(
      VAR_GROUPS.flatMap((group) => group.items.map((item) => item.variable)),
    );
    expect(slotRows).toEqual(new Set(EDITABLE_VARS));
  });
});

describe('C1: every failing pair self-reports inline (card retired)', () => {
  const editable = new Set<string>(EDITABLE_VARS);

  it('keeps BOTH endpoints of every contract pair editable, so editing either self-reports (C3)', () => {
    // Any endpoint that is not an editable slot row surfaces here by name.
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
