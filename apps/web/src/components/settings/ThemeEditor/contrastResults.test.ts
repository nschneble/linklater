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
  pairsForBundle,
  tokenContrastFailures,
} from './contrastResults';
import type { ContrastPair, ContrastResults } from './contrastResults';
import { BUNDLES } from './useThemeOverrides';

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
