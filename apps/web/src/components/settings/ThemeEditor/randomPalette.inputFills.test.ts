/*
 * The Randomize button against the input fills it used to ignore.
 *
 * The generator solved every foreground away from its bundle background
 * and treated the form-input fill as decoration, so a foreground that
 * cleared its threshold by a hair against one surface failed against the
 * other. The editor scored none of those pairs, so it reported a pass over
 * a palette failing SC 1.4.3 and SC 1.4.11 on every text input in the app.
 *
 * The pairs are frozen here by name rather than derived, so the sweep
 * measures the same eight pairs before and after the fix, and a separate
 * assertion holds the frozen list to what the shared builders emit.
 * Measurement goes through the same color math the static bundle suites
 * use, not the generator's own model, so it cannot mark its own homework.
 *
 * The sweep runs on ONE derivation per seed, not the public entry point.
 * Adding the pairs to the contract without touching the derivation already
 * turns that entry point green, because it throws failing draws away and
 * forces the last one to the contrast extremes. That is the rejection
 * sampling the generator promises not to do, and a sweep blind to the
 * difference would have certified it.
 */

import { BUNDLES, EDITABLE_VARS } from './useThemeOverrides';
import { contrastRatio, parseColor } from '../../../theme/colorMath';
import {
  derivePaletteOnce,
  generateRandomPalette,
  type Palette,
} from './randomPalette';
import { describe, expect, it } from 'vitest';
import { focusRingPairs, pairsForBundle } from './contrastResults.pairs';
import { resolveFg } from '../../../theme/styles/bundles-color-utils';
import type { Mode } from '../../../theme/constants';
import type { Rgb } from '../../../theme/colorMath';
import type { ThemeVariable } from './useThemeOverrides';

type PairSpec = readonly [
  foreground: string,
  background: string,
  threshold: number,
];

const INPUT_FILL_PAIRS: readonly PairSpec[] = [
  ['--base-text', '--base-input-bg', 4.5],
  ['--base-alt-text', '--base-input-bg', 4.5],
  ['--base-border', '--base-input-bg', 3],
  ['--mount-text', '--mount-input-bg', 4.5],
  ['--mount-alt-text', '--mount-input-bg', 4.5],
  ['--mount-border', '--mount-input-bg', 3],
  ['--focus-ring', '--base-input-bg', 3],
  ['--focus-ring', '--mount-input-bg', 3],
];

const SWEEP_SEEDS = 2000;
const MODES: Mode[] = ['light', 'dark'];

/**
 * The ratio of two opaque values, refusing alpha on either side. A
 * translucent value has no flat ratio of its own, and the generator's
 * guarantee rests on emitting opaque hex, so the refusal is the point.
 */
function measure(foreground: string, background: string): number {
  return contrastRatio(
    resolveFg(parseColor(foreground)),
    resolveFg(parseColor(background)),
  );
}

/** A pair's ratio, refusing a slot the derivation never wrote. */
function ratioOf(palette: Palette, spec: PairSpec): number {
  const foreground = palette[spec[0] as ThemeVariable];
  const background = palette[spec[1] as ThemeVariable];
  if (foreground === undefined || background === undefined) {
    throw new Error(`${spec[0]} or ${spec[1]} was never derived`);
  }
  return measure(foreground, background);
}

/** Every frozen pair `palette` fails, described well enough to act on. */
function failingPairs(palette: Palette): string[] {
  return INPUT_FILL_PAIRS.flatMap((spec) => {
    const ratio = ratioOf(palette, spec);
    // not-a-number loses every comparison, so pass is the explicit branch
    if (ratio >= spec[2]) return [];
    return [`${spec[0]} on ${spec[1]} is ${ratio.toFixed(3)}`];
  });
}

function pairKey([foreground, background]: PairSpec): string {
  return `${foreground} on ${background}`;
}

interface SweepResult {
  perPair: Record<string, number>;
  seedsFailingAnyPair: number;
}

/** Seeds 0 to `SWEEP_SEEDS`, counting how often each pair falls short. */
function sweep(mode: Mode): SweepResult {
  const perPair: Record<string, number> = {};
  for (const spec of INPUT_FILL_PAIRS) perPair[pairKey(spec)] = 0;
  let seedsFailingAnyPair = 0;

  for (let seed = 0; seed < SWEEP_SEEDS; seed += 1) {
    const palette = derivePaletteOnce(mode, seed);
    let failed = false;
    for (const spec of INPUT_FILL_PAIRS) {
      if (ratioOf(palette, spec) >= spec[2]) continue;
      perPair[pairKey(spec)] += 1;
      failed = true;
    }
    if (failed) seedsFailingAnyPair += 1;
  }

  return { perPair, seedsFailingAnyPair };
}

function allZero(): Record<string, number> {
  return Object.fromEntries(INPUT_FILL_PAIRS.map((spec) => [pairKey(spec), 0]));
}

describe('the frozen pair list is what the shared builders emit', () => {
  it('matches the input-fill pairs the editor and generator both read', () => {
    const built = [
      ...BUNDLES.flatMap((bundle) => pairsForBundle(bundle)),
      ...focusRingPairs(),
    ]
      .filter((pair) => pair.background.endsWith('-input-bg'))
      .map((pair) => [pair.foreground, pair.background, pair.threshold]);

    expect(built).toEqual(
      INPUT_FILL_PAIRS.map((spec) => [spec[0], spec[1], spec[2]]),
    );
  });

  it('names an input fill on exactly the bundles that own one', () => {
    // the token vocabulary decides which bundles host a form input
    const owning = BUNDLES.filter((bundle) =>
      EDITABLE_VARS.includes(`--${bundle}-input-bg` as ThemeVariable),
    );
    const measured = new Set(
      INPUT_FILL_PAIRS.map(([, background]) => background),
    );

    expect(owning).toEqual(['base', 'mount']);
    expect([...measured].sort()).toEqual([
      '--base-input-bg',
      '--mount-input-bg',
    ]);
  });
});

describe('the harness can tell a failing pair from a passing one', () => {
  const clean: Palette = {
    '--base-text': '#000000',
    '--base-alt-text': '#000000',
    '--base-border': '#000000',
    '--base-input-bg': '#ffffff',
    '--mount-text': '#000000',
    '--mount-alt-text': '#000000',
    '--mount-border': '#000000',
    '--mount-input-bg': '#ffffff',
    '--focus-ring': '#000000',
  };

  it('flags nothing on a palette that clears every pair', () => {
    expect(failingPairs(clean)).toEqual([]);
  });

  it('flags the border that shipped as the known light-seed failure', () => {
    const known = {
      ...clean,
      '--base-border': '#838fa8',
      '--base-input-bg': '#eaf2f5',
    };

    expect(failingPairs(known)).toEqual([
      '--base-border on --base-input-bg is 2.867',
    ]);
  });

  it('refuses a slot the derivation never wrote instead of scoring it', () => {
    const missing = { ...clean, '--mount-input-bg': undefined };

    expect(() => failingPairs(missing)).toThrow('never derived');
  });

  it('would report zero failures if fed hex strings instead of channels', () => {
    // the trap this harness exists to avoid: hex in, not-a-number out,
    // and every later comparison against it is false
    const naive = contrastRatio(
      '#838fa8' as unknown as Rgb,
      '#eaf2f5' as unknown as Rgb,
    );

    expect(Number.isNaN(naive)).toBe(true);
    expect(naive < 3).toBe(false);
    expect(measure('#838fa8', '#eaf2f5')).toBeCloseTo(2.867, 3);
  });
});

describe(`one derivation per seed, ${SWEEP_SEEDS} seeds per mode`, () => {
  for (const mode of MODES) {
    it(`${mode} mode clears every input-fill pair`, () => {
      const { perPair, seedsFailingAnyPair } = sweep(mode);

      // soft, so a regression reports the per-pair counts AND the share of
      // seeds affected rather than stopping at the first of the two
      expect.soft(perPair).toEqual(allZero());
      expect.soft(seedsFailingAnyPair).toBe(0);
    });
  }
});

describe('the two seeds that shipped a failing palette', () => {
  it.each([
    ['light' as Mode, 1],
    ['dark' as Mode, 2],
  ])('%s seed %i clears every input-fill pair', (mode, seed) => {
    // the derivation first, then the entry point users press, since a
    // repair pass would carry the second on its own
    expect(failingPairs(derivePaletteOnce(mode, seed))).toEqual([]);
    expect(failingPairs(generateRandomPalette(mode, seed))).toEqual([]);
  });
});
