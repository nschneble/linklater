/*
 * Cascade reading + CVD helpers for the bundle-level suites, which parse the
 * theme stylesheets off disk.
 *
 * The WCAG math itself lives in `../colorMath.ts` and is re-exported here so
 * the suites keep one import. That module is browser-safe; this one is not
 * (it reads CSS with `node:fs`), which is exactly why the theme editor could
 * not share it and grew a second copy of the formulas.
 *
 * Not a runtime dependency of the app. Tests-only.
 */

import {
  compositeOverBg,
  contrastRatio,
  luminanceRatio,
  parseColor,
  relativeLuminance,
} from '../colorMath';
import {
  differenceCiede2000,
  filterDeficiencyDeuter,
  filterDeficiencyProt,
  filterDeficiencyTrit,
} from 'culori';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import type { Rgb, Rgba } from '../colorMath';

export {
  compositeOverBg,
  contrastRatio,
  luminanceRatio,
  parseColor,
  relativeLuminance,
};
export type { Rgb, Rgba };

export const BUNDLES = [
  'base',
  'mount',
  'orbit',
  'alert',
  'warn',
  'info',
  'success',
] as const;
export type Bundle = (typeof BUNDLES)[number];

export const STATE_BUNDLES: readonly Bundle[] = [
  'alert',
  'warn',
  'info',
  'success',
];

export const CARD_BUNDLES: readonly Bundle[] = [
  'mount',
  'orbit',
  'alert',
  'warn',
  'info',
  'success',
];

export const SLOTS = [
  'bg',
  'border',
  'text',
  'alt-text',
  'highlight',
  'highlight-fg',
  'highlight-hover',
] as const;
export type Slot = (typeof SLOTS)[number];

const STYLES_DIR = dirname(fileURLToPath(import.meta.url));

/*
 * Combined CSS source the contrast + distinguishability suites scan.
 * `bundles.css` holds the `:root` + `[data-mode='dark']` synthetic
 * fallbacks; each per-theme `.css` file holds that theme's
 * `[data-theme='X'][data-mode='Y']` blocks. Concatenating
 * them preserves the test API - `extractBlock(BUNDLES_CSS, selector)`
 * resolves any per-theme selector regardless of which file it lives in.
 * No within-file source-order semantics rely on this concatenation: every
 * on-book per-theme selector has specificity (0, 2, 0) vs the (0, 1, 0) of
 * the bundles.css fallbacks, so cascade order is governed by specificity.
 *
 * `branding.css` is the OFF-BOOK brand-chrome theme: a single
 * mode-independent `[data-theme='branding']` block (specificity (0, 1, 0)).
 * It only ever paints under the `data-theme='branding'` wrapper ApiDocsView
 * sets directly, so its lower specificity vs other per-theme blocks is moot -
 * the contrast suite extracts it by exact selector, not by cascade order.
 */
const PER_THEME_FILES = [
  'apollo-10-1-2.css',
  'before-midnight.css',
  'before-sunrise.css',
  'before-sunset.css',
  'boyhood.css',
  'branding.css',
  'dazed-and-confused.css',
  'hit-man.css',
  'nouvelle-vague.css',
  'scanner-darkly.css',
  'school-of-rock.css',
] as const;

export const BUNDLES_CSS = [
  readFileSync(resolve(STYLES_DIR, 'bundles.css'), 'utf8'),
  ...PER_THEME_FILES.map((file) =>
    readFileSync(resolve(STYLES_DIR, file), 'utf8'),
  ),
].join('\n');

/**
 * Resolves an opaque foreground to its rendered channels.
 *
 * REFUSES a translucent value rather than quietly dropping its alpha. WCAG's
 * relative-luminance formula has no alpha term, so a translucent color has no
 * contrast ratio of its own; only its composited result does. Discarding the
 * alpha measures a color nobody can see, and reports it as a PASS: an
 * `#eeeede40` body text reads as clearing 15:1 when what renders is nearer
 * 2:1. Throwing turns that silent false pass into a failure that names its
 * own fix.
 *
 * No shipped token carries alpha on a foreground slot, so this cannot fire
 * today. It fires the moment one is introduced, which is precisely when the
 * caller has to composite over the real backdrop instead.
 */
export function resolveFg(value: Rgba): Rgb {
  if (value[3] < 1) {
    throw new Error(
      `resolveFg received a translucent color (alpha ${value[3]}). ` +
        'A translucent foreground has no contrast ratio of its own: ' +
        'composite it over its backdrop with compositeOverBg first.',
    );
  }
  return [value[0], value[1], value[2]];
}

/**
 * Removes every CSS comment, because comments are consumed at tokenization
 * and so no boundary a reader looks for may fall inside one. Shared at two
 * call sites against the usual 3x rule because divergent copies are how a
 * comment came to decide where a cascade block ended.
 *
 * Exported for callers that measure a POSITION rather than extract a
 * block: an `indexOf` over a selector finds its first mention, which is
 * routinely a comment about the block rather than the block. Both readers
 * need the same stripped string for their offsets to compare.
 */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function extractBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = stripComments(source).match(pattern);
  if (!match) {
    throw new Error(`Cascade block not found: ${selector}`);
  }
  return match[1];
}

export function parseDeclarations(block: string): Map<string, string> {
  const declarations = new Map<string, string>();
  const withoutComments = stripComments(block);
  // a value may wrap across lines but never reach the next --token:
  const pattern = /--([a-z-]+)\s*:\s*((?:(?!--[a-z-]+\s*:)[^;{}])+);/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutComments)) !== null) {
    declarations.set(match[1], match[2].trim());
  }
  return declarations;
}

export function getSlot(
  declarations: Map<string, string>,
  bundle: Bundle,
  slot: Slot,
): Rgba | null {
  const value = declarations.get(`${bundle}-${slot}`);
  if (value === undefined) {
    return null;
  }
  if (value.includes('var(')) {
    return null;
  }
  return parseColor(value);
}

export function bundleIsFullyDefined(
  declarations: Map<string, string>,
  bundle: Bundle,
): boolean {
  return SLOTS.every((slot) => getSlot(declarations, bundle, slot) !== null);
}

export function readPageBg(
  themeCss: string,
  selector: string,
  variable: string,
): Rgb {
  const block = extractBlock(themeCss, selector);
  const declarations = parseDeclarations(block);
  const value = declarations.get(variable);
  if (value === undefined) {
    throw new Error(`No --${variable} in ${selector}`);
  }
  const color = parseColor(value);
  return [color[0], color[1], color[2]];
}

export function describeRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

export const CVD_TYPES = ['protanopia', 'deuteranopia', 'tritanopia'] as const;
export type CvdType = (typeof CVD_TYPES)[number];

/*
 * culori's CVD filters expect a color object; build one per call (they're
 * lightweight) so the public surface stays a plain RGB-tuple → number.
 *
 * Severity 1 = full dichromacy (protan-/deuter-/tritan-OPIA, not the milder
 * -OMALY variants). Worst-case is what we want to guarantee against.
 */
const cvdFilters = {
  protanopia: filterDeficiencyProt(1),
  deuteranopia: filterDeficiencyDeuter(1),
  tritanopia: filterDeficiencyTrit(1),
} as const;

const deltaE2000 = differenceCiede2000();

function rgbToCuloriColor([red, green, blue]: Rgb) {
  return {
    mode: 'rgb' as const,
    r: red / 255,
    g: green / 255,
    b: blue / 255,
  };
}

/*
 * Delta-E 2000 between two sRGB colors after both are simulated through the
 * given CVD transform. Returns a perceptual distance in CIE Lab65 - higher =
 * more distinguishable to a viewer with that deficiency.
 */
export function cvdDeltaE(first: Rgb, second: Rgb, cvd: CvdType): number {
  const filter = cvdFilters[cvd];
  const firstSimulated = filter(rgbToCuloriColor(first));
  const secondSimulated = filter(rgbToCuloriColor(second));
  if (firstSimulated === undefined || secondSimulated === undefined) {
    throw new Error(`CVD filter ${cvd} returned undefined`);
  }
  return deltaE2000(firstSimulated, secondSimulated);
}
