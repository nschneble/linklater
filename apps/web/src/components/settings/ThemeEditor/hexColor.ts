/*
 * Shared hex/color-value helpers for the Theme Editor's editable rows.
 *
 * Both the demoted token-tree rows (`ColorRow`) and the human knobs
 * (`KnobRow`) parse, normalize, and validate the same color strings, so the
 * vocabulary lives in one place rather than being duplicated per row type.
 */

const HEX3 = /^#[0-9a-fA-F]{3}$/;
const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX8 = /^#[0-9a-fA-F]{8}$/;
const RGBA = /^rgba?\(/i;

/**
 * Expands a 3-digit hex shorthand (e.g. `#abc`) to 6-digit form (`#aabbcc`).
 * Returns the trimmed input unchanged if it is already 6-digit or not a valid
 * 3-digit hex.
 */
export function normalizeToSixDigitHex(value: string): string {
  const trimmed = value.trim();
  if (HEX3.test(trimmed)) {
    const digits = trimmed.slice(1);
    return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
  }
  return trimmed;
}

/** True when the value is a 6-digit `#RRGGBB` hex (the native picker's domain). */
export function isSixDigitHex(value: string): boolean {
  return HEX6.test(value);
}

/**
 * True when the value is a color the editor accepts: 6- or 8-digit hex, or an
 * `rgb()`/`rgba()` expression. Alpha forms are valid values (kept editable via
 * the text input) even though the native color picker cannot represent them.
 */
export function isValidColorValue(value: string): boolean {
  return HEX6.test(value) || HEX8.test(value) || RGBA.test(value);
}
