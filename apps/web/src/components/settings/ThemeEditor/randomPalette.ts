import {
  computeContrastRatio,
  focusRingPairs,
  pairsForBundle,
} from './contrastResults';
import { converter, formatHex, type Oklch } from 'culori';
import {
  BUNDLES,
  CARD_BUNDLES,
  EDITABLE_VARS,
  FOCUS_RING_VAR,
  type Bundle,
  type ThemeVariable,
} from '../../../theme/customThemeTokens';
import type { Mode } from '../../../theme/constants';

/**
 * Generates a random Custom-theme palette for ONE mode that PROVABLY clears the
 * full WCAG AA contract the live editor enforces (PRD point 11). This is the
 * "Randomize" button's engine. The hard guarantee is the headline: the returned
 * map satisfies every pair `pairsForBundle()` + `focusRingPairs()` produce, for
 * all 7 bundles + the focus ring — the SAME 52-pair set `randomPalette.test.ts`
 * asserts, derived from the same exported builders so generator and checker can
 * never drift.
 *
 * The strategy is DERIVE-TO-SATISFY, never blind rejection sampling: each
 * background is chosen first (in a mode-appropriate lightness band), then every
 * foreground is solved AWAY from its background in the contrast-increasing
 * direction and nudged until it clears its threshold. The single source of
 * contrast truth is the editor's own `computeContrastRatio`, so the generator
 * and the live checker can't disagree. Pure black (`#000000`) / pure white
 * (`#ffffff`) are the guaranteed fallbacks — they give the maximal ratio — so
 * the nudge loop and the defensive outer loop always terminate with a passing
 * palette.
 *
 * Every emitted value is 6-digit hex: `computeContrastRatio` returns `null` on
 * alpha / non-hex input, which would be a SILENT contract hole, so the generator
 * never emits anything else. `input-bg` slots have no contrast pair and are set
 * cosmetically inside the bg band.
 *
 * CVD distinguishability is BEST-EFFORT (the 4 state bundles get hues spaced
 * ~90° apart), not a hard gate — the editor validates CVD live, and the WCAG
 * contract is the only thing this function must guarantee.
 */

const toOklch = converter('oklch');

/** A seedable RNG so a failing test iteration is reproducible. */
export type Rng = () => number;

/**
 * Mulberry32 — a tiny, fast, well-distributed seedable PRNG. Used so a failing
 * 200-iteration test case can be reproduced from its seed. When no seed is
 * passed the generator falls back to `Math.random`.
 */
function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result =
      (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

/** The lightness band each mode's BACKGROUND slots sit in. */
export const BG_BAND: Record<Mode, { min: number; max: number }> = {
  light: { min: 0.92, max: 0.98 },
  dark: { min: 0.1, max: 0.18 },
};

/**
 * The direction foregrounds move to gain contrast against their (band-fixed)
 * background. In light mode backgrounds are near-white, so foregrounds go DOWN
 * in lightness; in dark mode they go UP. Monotone, so the nudge loop converges
 * on the contrast extreme.
 */
const FG_DIRECTION: Record<Mode, 1 | -1> = {
  light: -1,
  dark: 1,
};

/** Lightness step the nudge loop walks per iteration, in oklch L units. */
const NUDGE_STEP = 0.03;
/** Cap on the inner nudge loop; the contrast extreme is reached well before. */
const MAX_NUDGE_STEPS = 64;
/** Cap on the defensive outer attempts before forcing remaining fgs to extremes. */
const MAX_ATTEMPTS = 8;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Builds a 6-digit hex from oklch components, clamping the result into sRGB so
 * `formatHex` never returns a short or out-of-gamut string. culori clamps
 * out-of-gamut oklch to the sRGB boundary on conversion, which is exactly what
 * we want — a slightly desaturated in-gamut color over an unrenderable one.
 */
export function oklchHex(
  lightness: number,
  chroma: number,
  hue: number,
): string {
  const color: Oklch = {
    mode: 'oklch',
    l: clamp01(lightness),
    c: Math.max(0, chroma),
    h: hue,
  };
  // `formatHex` rounds to the nearest in-gamut sRGB hex.
  return formatHex(color);
}

/** A random lightness within `[min, max]`. */
function randomBandLightness(rng: Rng, mode: Mode): number {
  const band = BG_BAND[mode];
  return band.min + rng() * (band.max - band.min);
}

/**
 * The lightness of a hex, read back through oklch, so the nudge loop can start
 * a foreground from its background's lightness and walk away from it.
 */
function lightnessOf(hex: string): number {
  const parsed = toOklch(hex);
  return parsed?.l ?? 0.5;
}

/**
 * The core DERIVE → VERIFY → NUDGE primitive. Given a fixed background and a
 * target threshold, it walks a foreground's lightness away from the background
 * (in the mode's contrast-increasing direction) until the measured ratio clears
 * the threshold, then returns the foreground hex. Converges because the extreme
 * (#000000 / #ffffff) gives the maximal ratio; capped defensively.
 *
 * Chroma + hue are caller-chosen and held fixed while only lightness moves, so
 * the foreground keeps its intended color family while gaining contrast.
 */
export function deriveForeground(
  backgroundHex: string,
  threshold: number,
  mode: Mode,
  hue: number,
  chroma: number,
): string {
  const direction = FG_DIRECTION[mode];
  const backgroundLightness = lightnessOf(backgroundHex);
  // start a stride from bg so the first sample leans to contrast
  let lightness = clamp01(backgroundLightness + direction * NUDGE_STEP * 4);

  for (let step = 0; step < MAX_NUDGE_STEPS; step += 1) {
    const candidate = oklchHex(lightness, chroma, hue);
    const ratio = computeContrastRatio(candidate, backgroundHex);
    if (ratio !== null && ratio >= threshold) {
      return candidate;
    }
    const next = clamp01(lightness + direction * NUDGE_STEP);
    if (next === lightness) break; // hit the 0/1 rail
    lightness = next;
  }

  // rail reached without clearing: fall back to the pure contrast extreme
  return direction === 1 ? '#ffffff' : '#000000';
}

/**
 * Like `deriveForeground` but must clear a SECONDARY background too — used by
 * the cross-bundle border guard, which needs `B-border` to clear BOTH its own
 * `B-bg` AND `--base-bg`. Solves against the tighter (lower-contrast) of the two
 * backgrounds at each step so both end up satisfied.
 */
function deriveForegroundDualBackground(
  backgroundHexA: string,
  backgroundHexB: string,
  threshold: number,
  mode: Mode,
  hue: number,
  chroma: number,
): string {
  const direction = FG_DIRECTION[mode];
  // anchor to whichever bg the fg must travel furthest from to clear
  const anchorLightness = Math.max(
    lightnessOf(backgroundHexA),
    lightnessOf(backgroundHexB),
  );
  let lightness = clamp01(anchorLightness + direction * NUDGE_STEP * 4);

  for (let step = 0; step < MAX_NUDGE_STEPS; step += 1) {
    const candidate = oklchHex(lightness, chroma, hue);
    const ratioA = computeContrastRatio(candidate, backgroundHexA);
    const ratioB = computeContrastRatio(candidate, backgroundHexB);
    if (
      ratioA !== null &&
      ratioB !== null &&
      ratioA >= threshold &&
      ratioB >= threshold
    ) {
      return candidate;
    }
    const next = clamp01(lightness + direction * NUDGE_STEP);
    if (next === lightness) break;
    lightness = next;
  }

  return direction === 1 ? '#ffffff' : '#000000';
}

/** A low-chroma background hue near `baseHue`, jittered slightly. */
function neutralBackgroundHex(rng: Rng, mode: Mode, baseHue: number): string {
  const hue = (baseHue + (rng() - 0.5) * 30 + 360) % 360;
  // backgrounds carry a whisper of chroma so text/border can reach AA
  const chroma = 0.005 + rng() * 0.02;
  return oklchHex(randomBandLightness(rng, mode), chroma, hue);
}

/** The accumulating palette, written slot-by-slot as each is derived. */
export type Palette = Partial<Record<ThemeVariable, string>>;

function setSlot(
  palette: Palette,
  bundle: Bundle,
  slot: string,
  value: string,
): void {
  palette[`--${bundle}-${slot}` as ThemeVariable] = value;
}

/**
 * Derives every foreground slot of one bundle against its already-fixed `bg`.
 * `mount`/`orbit` pass `crossBundleGuard` so their border also clears
 * `--base-bg`; `base` passes its `subtle-text` slot too.
 */
function deriveBundle(
  palette: Palette,
  bundle: Bundle,
  bundleBgHex: string,
  baseBgHex: string,
  mode: Mode,
  rng: Rng,
  textHue: number,
): void {
  setSlot(palette, bundle, 'bg', bundleBgHex);

  // text slots: ≥4.5 vs bundle bg; low chroma leaves room to reach AA
  setSlot(
    palette,
    bundle,
    'text',
    deriveForeground(bundleBgHex, 4.5, mode, textHue, 0.02),
  );
  setSlot(
    palette,
    bundle,
    'alt-text',
    deriveForeground(bundleBgHex, 4.5, mode, (textHue + 20) % 360, 0.03),
  );

  const borderHue = (textHue + 40) % 360;
  if (CARD_BUNDLES.includes(bundle)) {
    setSlot(
      palette,
      bundle,
      'border',
      deriveForegroundDualBackground(
        bundleBgHex,
        baseBgHex,
        3,
        mode,
        borderHue,
        0.04,
      ),
    );
  } else {
    setSlot(
      palette,
      bundle,
      'border',
      deriveForeground(bundleBgHex, 3, mode, borderHue, 0.04),
    );
  }

  const highlightHue = (textHue + 200) % 360;
  const { highlight, highlightHover, highlightFg } = deriveHighlightTriple(
    bundleBgHex,
    highlightHue,
    rng,
  );
  setSlot(palette, bundle, 'highlight', highlight);
  setSlot(palette, bundle, 'highlight-hover', highlightHover);
  setSlot(palette, bundle, 'highlight-fg', highlightFg);

  if (bundle === 'base') {
    setSlot(
      palette,
      bundle,
      'subtle-text',
      deriveForeground(bundleBgHex, 4.5, mode, (textHue + 60) % 360, 0.02),
    );
  }
}

export interface HighlightTriple {
  highlight: string;
  highlightHover: string;
  highlightFg: string;
}

/**
 * Derives the three coupled highlight slots as one accent-button unit so all
 * three of their contract pairs hold BY CONSTRUCTION:
 *   highlight     ≥ 3.0 vs bundle-bg
 *   highlight-fg  ≥ 4.5 vs highlight AND vs highlight-hover
 *
 * The trap (a mid-lightness highlight where NEITHER black nor white text clears
 * 4.5) is avoided by FIXING the foreground extreme first (white, the universal
 * accent-button choice), then deriving both highlight states DARK ENOUGH to
 * carry white at 4.5 while still clearing 3.0 against the bundle bg:
 *   - light mode: the bg is near-white, so a dark highlight clears 3.0 against
 *     it trivially; we drive the highlight lightness down until white reads at
 *     4.5, which also keeps the ≥3.0-vs-bg margin.
 *   - dark mode: the bg is near-black, so the highlight must be LIGHTER than the
 *     bg to clear 3.0 — but not so light that white text fails on it. The
 *     feasible window (white-fg ≥4.5 ⇒ highlight L ≲ 0.5; vs-bg ≥3.0 ⇒ highlight
 *     L above the bg) is non-empty because the bg sits at L≈0.10-0.18.
 * The hover is a small same-hue lightness step that re-verifies both
 * constraints; if the step would break either it falls back to the highlight
 * itself (a no-op hover still satisfies the contract).
 *
 * Mode-agnostic by design: it always walks the highlight lightness UP from a
 * dark start, which satisfies BOTH modes (the white-fg constraint pins the
 * highlight dark; the vs-bg constraint only needs the highlight away from the
 * bg, which a dark highlight clears against a light bg and a mid-dark highlight
 * clears against a near-black bg).
 */
export function deriveHighlightTriple(
  bundleBgHex: string,
  hue: number,
  rng: Rng,
): HighlightTriple {
  const foreground = '#ffffff';
  const chroma = 0.07 + rng() * 0.06;

  // walk highlight L up from dark until white ≥4.5 on it and ≥3 vs bg
  const findHighlight = (startLightness: number): string => {
    let lightness = startLightness;
    let best = oklchHex(lightness, chroma, hue);
    for (let step = 0; step < MAX_NUDGE_STEPS; step += 1) {
      const candidate = oklchHex(lightness, chroma, hue);
      const fgRatio = computeContrastRatio(foreground, candidate);
      const bgRatio = computeContrastRatio(candidate, bundleBgHex);
      if (
        fgRatio !== null &&
        bgRatio !== null &&
        fgRatio >= 4.5 &&
        bgRatio >= 3
      ) {
        return candidate;
      }
      best = candidate;
      lightness = clamp01(lightness + 0.02);
    }
    return best;
  };

  let highlight = findHighlight(0.18);
  // defensive only: unreachable for in-band bgs; forceExtreme repairs it
  if (
    (computeContrastRatio(foreground, highlight) ?? 0) < 4.5 ||
    (computeContrastRatio(highlight, bundleBgHex) ?? 0) < 3
  ) {
    highlight = oklchHex(0.4, chroma, hue);
  }

  // hover: a small lightness step that keeps both constraints; else no-op
  const highlightLightness = lightnessOf(highlight);
  const hoverCandidate = oklchHex(
    clamp01(highlightLightness + 0.06),
    chroma,
    hue,
  );
  const hoverFgRatio = computeContrastRatio(foreground, hoverCandidate);
  const hoverBgRatio = computeContrastRatio(hoverCandidate, bundleBgHex);
  let highlightHover: string;
  if (
    hoverFgRatio !== null &&
    hoverBgRatio !== null &&
    hoverFgRatio >= 4.5 &&
    hoverBgRatio >= 3
  ) {
    highlightHover = hoverCandidate;
  } else {
    // step broke a constraint; no-op hover still satisfies the contract
    highlightHover = highlight;
  }

  return { highlight, highlightHover, highlightFg: foreground };
}

/**
 * Derives `--focus-ring` LAST: it must clear 3:1 against base-bg, mount-bg, and
 * orbit-bg (all now fixed). Walks a hue-fixed lightness to the extreme that
 * maximizes the MINIMUM ratio across all three.
 */
function deriveFocusRing(
  baseBgHex: string,
  mountBgHex: string,
  orbitBgHex: string,
  mode: Mode,
  hue: number,
): string {
  const backgrounds = [baseBgHex, mountBgHex, orbitBgHex];
  const direction = FG_DIRECTION[mode];
  // all three bgs share the band, so one walk away clears all three
  const anchor =
    mode === 'light'
      ? Math.max(...backgrounds.map(lightnessOf))
      : Math.min(...backgrounds.map(lightnessOf));
  let lightness = clamp01(anchor + direction * NUDGE_STEP * 4);

  for (let step = 0; step < MAX_NUDGE_STEPS; step += 1) {
    const candidate = oklchHex(lightness, 0.12, hue);
    const ratios = backgrounds.map((background) =>
      computeContrastRatio(candidate, background),
    );
    if (ratios.every((ratio) => ratio !== null && ratio >= 3)) {
      return candidate;
    }
    const next = clamp01(lightness + direction * NUDGE_STEP);
    if (next === lightness) break;
    lightness = next;
  }

  return direction === 1 ? '#ffffff' : '#000000';
}

/** Cosmetic input-bg (no contrast pair): a near-bg neutral in the bg band. */
function inputBgHex(rng: Rng, mode: Mode, baseHue: number): string {
  const hue = (baseHue + (rng() - 0.5) * 20 + 360) % 360;
  return oklchHex(randomBandLightness(rng, mode), 0.01, hue);
}

/**
 * Builds the whole current-MODE palette once. Returns a partial map; the public
 * entry point verifies + repairs it before returning a complete one.
 */
function buildAttempt(mode: Mode, rng: Rng): Palette {
  const palette: Palette = {};

  // A) fix --base-bg FIRST: the anchor every cross-bundle pair answers to
  const baseHue = rng() * 360;
  const baseBgHex = neutralBackgroundHex(rng, mode, baseHue);

  // B) base bundle, derived against the fixed base-bg.
  deriveBundle(palette, 'base', baseBgHex, baseBgHex, mode, rng, baseHue);
  palette['--base-input-bg' as ThemeVariable] = inputBgHex(rng, mode, baseHue);

  // C) mount/orbit near base hue; state bundles 90°-spaced for CVD spread
  const stateRotation = rng() * 360;
  const stateBundles = ['alert', 'warn', 'info', 'success'] as const;

  for (const bundle of CARD_BUNDLES) {
    let bundleHue: number;
    if (bundle === 'mount' || bundle === 'orbit') {
      bundleHue = (baseHue + (rng() - 0.5) * 40 + 360) % 360;
    } else {
      const stateIndex = stateBundles.indexOf(
        bundle as (typeof stateBundles)[number],
      );
      bundleHue = (stateRotation + stateIndex * 90) % 360;
    }
    const bundleBgHex = neutralBackgroundHex(rng, mode, bundleHue);
    deriveBundle(palette, bundle, bundleBgHex, baseBgHex, mode, rng, bundleHue);
    if (bundle === 'mount') {
      palette['--mount-input-bg' as ThemeVariable] = inputBgHex(
        rng,
        mode,
        bundleHue,
      );
    }
  }

  // D) focus ring LAST, against the now-fixed base/mount/orbit bgs.
  palette[FOCUS_RING_VAR] = deriveFocusRing(
    baseBgHex,
    palette['--mount-bg' as ThemeVariable]!,
    palette['--orbit-bg' as ThemeVariable]!,
    mode,
    rng() * 360,
  );

  return palette;
}

/** The full 52-pair contract, rebuilt from the bundle/focus pair builders. */
export interface PairCheck {
  foreground: ThemeVariable;
  background: ThemeVariable;
  threshold: number;
}

/**
 * Verifies a built palette against the SAME pairs the live editor enforces, and
 * returns the foregrounds that still fail (with their bg + threshold) so the
 * outer loop can force them to the contrast extreme on the final attempt.
 */
function failingForegrounds(palette: Palette, pairs: PairCheck[]): PairCheck[] {
  const failures: PairCheck[] = [];
  for (const pair of pairs) {
    const foreground = palette[pair.foreground];
    const background = palette[pair.background];
    let ratio: number | null;
    if (foreground !== undefined && background !== undefined) {
      ratio = computeContrastRatio(foreground, background);
    } else {
      ratio = null;
    }
    if (ratio === null || ratio < pair.threshold) {
      failures.push(pair);
    }
  }
  return failures;
}

/**
 * The full contract pair list, in the generator's `PairCheck` space, DERIVED
 * from the editor's own `pairsForBundle` / `focusRingPairs` builders — the same
 * builders `useContrastResults` (the live checker) and `randomPalette.test.ts`
 * (the gate) read. Sharing one definition means the generator's repair pass can
 * never check a different pair set than the editor enforces; there is nothing to
 * keep in sync. `PairCheck` consumes only foreground/background/threshold, so
 * dropping the builders' `label`/`criterion` is a lossless projection.
 */
function contractPairs(): PairCheck[] {
  return [
    ...BUNDLES.flatMap((bundle) => pairsForBundle(bundle)),
    ...focusRingPairs(),
  ].map((pair) => ({
    foreground: pair.foreground as ThemeVariable,
    background: pair.background as ThemeVariable,
    threshold: pair.threshold,
  }));
}

const CONTRACT_PAIRS = contractPairs();

/**
 * Forces a still-failing foreground to whichever pure extreme clears its
 * background — the guaranteed terminator. For a focus-ring or border that
 * answers to multiple bgs the SAME extreme clears all of them (all bgs sit in
 * one band), so a single extreme per foreground suffices.
 */
export function forceExtreme(palette: Palette, pair: PairCheck): void {
  const background = palette[pair.background];
  if (background === undefined) return;
  const blackRatio = computeContrastRatio('#000000', background) ?? 0;
  const whiteRatio = computeContrastRatio('#ffffff', background) ?? 0;
  if (blackRatio >= whiteRatio) {
    palette[pair.foreground] = '#000000';
  } else {
    palette[pair.foreground] = '#ffffff';
  }
}

/**
 * Generates a random palette for `mode` that clears the full WCAG AA contract.
 *
 * Tries up to `MAX_ATTEMPTS` fresh derivations; the FINAL attempt forces any
 * still-failing foreground to its contrast extreme, so the function ALWAYS
 * returns a complete, 52-pair-passing, all-6-digit-hex palette covering every
 * `EDITABLE_VARS` key.
 *
 * @param mode  Which mode's palette to generate. The OTHER mode is the caller's
 *              responsibility to preserve.
 * @param seed  Optional RNG seed for reproducibility; omitted uses `Math.random`.
 */
export function generateRandomPalette(
  mode: Mode,
  seed?: number,
): Record<ThemeVariable, string> {
  const rng: Rng = seed === undefined ? Math.random : mulberry32(seed);

  let palette: Palette = {};
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    palette = buildAttempt(mode, rng);
    const failures = failingForegrounds(palette, CONTRACT_PAIRS);
    if (failures.length === 0) break;
    if (attempt === MAX_ATTEMPTS - 1) {
      // force remaining failures to extremes; repeat until stable
      let remaining = failures;
      let guard = 0;
      while (remaining.length > 0 && guard < 8) {
        for (const pair of remaining) {
          forceExtreme(palette, pair);
        }
        remaining = failingForegrounds(palette, CONTRACT_PAIRS);
        guard += 1;
      }
    }
  }

  // every EDITABLE_VARS key present as 6-digit hex, else band fallback
  const complete = {} as Record<ThemeVariable, string>;
  for (const variable of EDITABLE_VARS) {
    const value = palette[variable];
    if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
      complete[variable] = value;
    } else {
      // derivation didn't write this slot (shouldn't happen): fallback
      complete[variable] = oklchHex(
        randomBandLightness(rng, mode),
        0.01,
        rng() * 360,
      );
    }
  }
  return complete;
}
