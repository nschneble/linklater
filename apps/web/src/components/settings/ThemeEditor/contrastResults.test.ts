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
import { BUNDLES, EDITABLE_VARS, VAR_GROUPS } from './useThemeOverrides';
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
