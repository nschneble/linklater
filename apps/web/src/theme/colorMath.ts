/*
 * WCAG color math, shared by the theme editor and the static bundle suites.
 *
 * This module is deliberately BROWSER-SAFE: no `node:fs`, no CSS reading, no
 * bundle-domain knowledge. Its sibling `styles/bundles-color-utils.ts` reads
 * the theme stylesheets off disk, which is why the editor could not import it
 * and grew a second copy of the same formulas instead.
 *
 * Two implementations of relative luminance in one repo means the number the
 * editor shows a user and the number CI enforces can disagree without anyone
 * noticing. There is one implementation now, and both sides read it.
 */

export type Rgb = readonly [number, number, number];
export type Rgba = readonly [number, number, number, number];

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

/**
 * Flattens a translucent color against what sits behind it. WCAG's luminance
 * formula has no alpha term, so a translucent color has no contrast ratio of
 * its own; only the result of this does.
 */
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
