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

const HEX_BODY = /^[0-9a-fA-F]+$/;

/** A real number inside `[0, max]`; false for not-a-number and infinity. */
function inRange(value: number, max: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= max;
}

/*
 * Parsing is the ONLY place a value can be refused, so both parsers below
 * validate rather than convert-and-hope.
 *
 * Nothing downstream can recover from a bad read. A caller treats any returned
 * tuple as a successful measurement, and a not-a-number channel then passes
 * every later guard, because a comparison against it is false: it wins the
 * worst-ratio contest, and the winner is then not below threshold either, so
 * the palette rolls up as conforming. An out-of-range channel is worse, since
 * it yields a confident ratio far above the ceiling the formula can produce.
 */
function parseHex(hex: string): Rgba {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  const expanded =
    normalized.length === 3 || normalized.length === 4
      ? normalized
          .split('')
          .map((character) => character + character)
          .join('')
      : normalized;
  if (
    (expanded.length !== 6 && expanded.length !== 8) ||
    !HEX_BODY.test(expanded)
  ) {
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
  const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (
    !channels.every((channel) => inRange(channel, 255)) ||
    !inRange(alpha, 1)
  ) {
    throw new Error(`Cannot parse rgb color: ${value}`);
  }
  return [channels[0], channels[1], channels[2], alpha];
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
 * Source-over compositing, per CSS Compositing and Blending Level 1. Both
 * operands carry alpha, so a translucent source over a translucent backdrop
 * stays translucent: `a_out = a_s + a_b(1 - a_s)`, with each channel weighted
 * by its own contribution and divided back out of `a_out`.
 *
 * Two things this deliberately does NOT do. It does not convert to linear
 * light first: the browser blends in the destination space, which for these
 * tokens is gamma-encoded sRGB, and linearizing is WCAG's separate step in
 * `relativeLuminance`. A linear blend would report 50% black over white as
 * 188 instead of 128. It also does not round, so a multi-layer stack rounds
 * once at the end instead of once per layer.
 */
export function compositeOver(source: Rgba, backdrop: Rgba): Rgba {
  const sourceAlpha = source[3];
  const backdropAlpha = backdrop[3];
  const alpha = sourceAlpha + backdropAlpha * (1 - sourceAlpha);
  if (alpha === 0) {
    return [0, 0, 0, 0];
  }
  const blend = (sourceChannel: number, backdropChannel: number): number =>
    (sourceChannel * sourceAlpha +
      backdropChannel * backdropAlpha * (1 - sourceAlpha)) /
    alpha;
  return [
    blend(source[0], backdrop[0]),
    blend(source[1], backdrop[1]),
    blend(source[2], backdrop[2]),
    alpha,
  ];
}

/**
 * Flattens a translucent color against what sits behind it. WCAG's luminance
 * formula has no alpha term, so a translucent color has no contrast ratio of
 * its own; only the result of this does.
 *
 * PRECONDITION: `background` is OPAQUE. Dropping alpha and rounding to whole
 * channels is only sound because of that. Leaving it unstated is how a caller
 * came to feed this a translucent backdrop and get a plausible but wrong
 * number, so a stack whose backdrop may itself be translucent must use
 * `compositeOver` and round once at the end.
 */
export function compositeOverBg(foreground: Rgba, background: Rgb): Rgb {
  if (foreground[3] >= 1) {
    return [foreground[0], foreground[1], foreground[2]];
  }
  const composited = compositeOver(foreground, [
    background[0],
    background[1],
    background[2],
    1,
  ]);
  return [
    Math.round(composited[0]),
    Math.round(composited[1]),
    Math.round(composited[2]),
  ];
}
