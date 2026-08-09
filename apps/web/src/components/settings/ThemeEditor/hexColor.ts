/*
 * Shared hex/color-value helpers for the Theme Editor's editable slot rows
 * (`ColorRow`), which parse, normalize, and validate color strings. Kept in one
 * place so the vocabulary is not duplicated across the picker + hex inputs.
 */

import { parseColor } from '../../../theme/colorMath';

const HEX3 = /^#[0-9a-fA-F]{3}$/;
const HEX6 = /^#[0-9a-fA-F]{6}$/;
// A bare 3- or 6-digit hex body (no `#` prefix), e.g. `abc` or `aabbcc`.
const BARE_HEX_BODY = /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/;

/**
 * Normalizes a hex value toward canonical 6-digit `#RRGGBB` form (Postel's Law):
 *
 *  1. Prepends `#` when the input is a bare 3- or 6-digit hex body (`aabbcc` →
 *     `#aabbcc`, `abc` → `#abc`). Only bare hex bodies are rescued: `rgb()`,
 *     8-digit alpha hex, and true garbage are left untouched so validation can
 *     reject (or accept) them on their own terms.
 *  2. Expands 3-digit shorthand to 6-digit (`#abc` → `#aabbcc`).
 *  3. Lower-cases hex output so it matches the canonical `#000000` form the
 *     placeholder models (`ABC` → `#aabbcc`). Hex is case-insensitive, so this
 *     is cosmetic; non-hex values keep their original casing.
 *
 * Returns the trimmed input unchanged if it is already 6-digit or is not a
 * normalizable hex form.
 */
export function normalizeToSixDigitHex(value: string): string {
  const trimmed = value.trim();
  // prepend `#` so the 3→6 expansion below catches a bare hex body
  const prefixed = BARE_HEX_BODY.test(trimmed) ? `#${trimmed}` : trimmed;
  if (HEX3.test(prefixed)) {
    const digits = prefixed.slice(1).toLowerCase();
    return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
  }
  if (HEX6.test(prefixed)) {
    return prefixed.toLowerCase();
  }
  return prefixed;
}

/** True when the value is a 6-digit `#RRGGBB` hex (the native picker's domain). */
export function isSixDigitHex(value: string): boolean {
  return HEX6.test(value);
}

/**
 * True when the value is a color the editor accepts: hex, with or without an
 * alpha pair, or a color function. Alpha forms are valid values (kept editable
 * via the text input) even though the native color picker cannot represent
 * them.
 *
 * The answer is DELEGATED to the shared parser rather than shape-matched here,
 * so the set of values a row will commit is exactly the set the contrast
 * checker can read. When this was its own prefix test the two sets came apart:
 * a color function with channels past the top of the range cleared the row and
 * was stored verbatim, and the checker then reported a ratio no display can
 * produce. Nothing between the row and the checker validates colors, so the two
 * have to answer from one place.
 */
export function isValidColorValue(value: string): boolean {
  try {
    parseColor(value);
    return true;
  } catch {
    return false;
  }
}
