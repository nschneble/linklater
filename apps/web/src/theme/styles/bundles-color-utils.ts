/*
 * Shared color parsing + WCAG luminance helpers for bundle-level tests.
 * Used by both the contrast and distinguishability suites, which parse the
 * same cascade blocks and need the same hex / rgba / composite math.
 *
 * Not a runtime dependency of the app. Tests-only.
 */

import {
  differenceCiede2000,
  filterDeficiencyDeuter,
  filterDeficiencyProt,
  filterDeficiencyTrit,
} from 'culori';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export type Rgb = readonly [number, number, number];
export type Rgba = readonly [number, number, number, number];

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

function srgbToLinear(channel: number): number {
  const normalized = channel / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }
  return Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function relativeLuminance([red, green, blue]: Rgb): number {
  return (
    0.2126 * srgbToLinear(red) +
    0.7152 * srgbToLinear(green) +
    0.0722 * srgbToLinear(blue)
  );
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/*
 * Symmetric luminance ratio - used for distinguishability checks where the
 * "+0.05" offset of contrastRatio is wrong (it models text/bg perception, not
 * surface-vs-surface separability). Two surfaces with identical luminance
 * have a luminance ratio of exactly 1.
 */
export function luminanceRatio(first: Rgb, second: Rgb): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  if (darker === 0) {
    return Infinity;
  }
  return lighter / darker;
}

function parseHex(hex: string): Rgba {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  const expanded =
    normalized.length === 3 || normalized.length === 4
      ? normalized
          .split('')
          .map((character) => character + character)
          .join('')
      : normalized;
  if (expanded.length !== 6 && expanded.length !== 8) {
    throw new Error(`Cannot parse hex color: ${hex}`);
  }
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);
  const alpha =
    expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  return [red, green, blue, alpha];
}

function parseRgb(value: string): Rgba {
  const match = value.match(
    /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/i,
  );
  if (!match) {
    throw new Error(`Cannot parse rgb color: ${value}`);
  }
  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  return [red, green, blue, alpha];
}

export function parseColor(value: string): Rgba {
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) {
    return parseHex(trimmed);
  }
  if (trimmed.toLowerCase().startsWith('rgb')) {
    return parseRgb(trimmed);
  }
  throw new Error(`Unsupported color value: ${trimmed}`);
}

export function compositeOverBg(foreground: Rgba, background: Rgb): Rgb {
  const alpha = foreground[3];
  if (alpha >= 1) {
    return [foreground[0], foreground[1], foreground[2]];
  }
  const blend = (channel: number, baseChannel: number): number =>
    Math.round(alpha * channel + (1 - alpha) * baseChannel);
  return [
    blend(foreground[0], background[0]),
    blend(foreground[1], background[1]),
    blend(foreground[2], background[2]),
  ];
}

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

export function extractBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Cascade block not found: ${selector}`);
  }
  return match[1];
}

export function parseDeclarations(block: string): Map<string, string> {
  const declarations = new Map<string, string>();
  const pattern = /--([a-z-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block)) !== null) {
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
