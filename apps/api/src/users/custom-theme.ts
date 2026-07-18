import { BadRequestException } from '@nestjs/common';

/**
 * Server-side defense-in-depth guard for the user-editable Custom theme.
 *
 * The Custom theme palette is persisted verbatim to the `customTheme` JSON
 * column. The front-end Theme Editor already constrains what it sends, but the
 * API must not trust that: a crafted `PATCH /users/me` can post an arbitrarily
 * large blob or unknown keys. This module caps the payload size and rejects any
 * token key outside the canonical vocabulary. It is intentionally not a full
 * schema/color validator. The runtime injection on the client is what
 * ultimately sandboxes the CSS.
 *
 * The token allow-list mirrors `apps/web/src/theme/customThemeTokens.ts`
 * (`EDITABLE_VARS`). The API cannot import from the web workspace, so the
 * vocabulary is rebuilt here with the same generation rule. Keep the two in
 * sync when bundles or slots change.
 */

/** The 7 theme bundles. Mirror of `BUNDLES` in the web token module. */
const BUNDLES = [
  'base',
  'mount',
  'orbit',
  'alert',
  'warn',
  'info',
  'success',
] as const;

/** The 7 per-bundle slots. Mirror of `SLOTS` in the web token module. */
const SLOTS = [
  'bg',
  'border',
  'text',
  'alt-text',
  'highlight',
  'highlight-hover',
  'highlight-fg',
] as const;

/**
 * The full set of CSS custom-property names a Custom theme may define: 7
 * bundles x 7 slots, plus the base-only `subtle-text`, the base/mount
 * `input-bg`, and the universal `--focus-ring`.
 */
export const CUSTOM_THEME_TOKEN_KEYS: ReadonlySet<string> = new Set([
  ...BUNDLES.flatMap((bundle) => SLOTS.map((slot) => `--${bundle}-${slot}`)),
  '--base-subtle-text',
  '--base-input-bg',
  '--mount-input-bg',
  '--focus-ring',
]);

/**
 * Maximum serialized byte size of a persisted Custom theme. A fully-populated
 * palette (every token set in both modes) serializes to roughly 8 KB, so 16 KB
 * leaves generous headroom while still blocking an unbounded blob.
 */
export const MAX_CUSTOM_THEME_BYTES = 16 * 1024;

/** The two color modes a palette may carry. */
const VALID_MODE_KEYS: ReadonlySet<string> = new Set(['dark', 'light']);

type CustomThemePayload = {
  dark?: Record<string, string>;
  light?: Record<string, string>;
};

/**
 * Validates a Custom theme payload before it is persisted. Throws
 * `BadRequestException` when the payload exceeds {@link MAX_CUSTOM_THEME_BYTES},
 * carries a top-level key other than `dark`/`light`, or contains any token key
 * outside {@link CUSTOM_THEME_TOKEN_KEYS}.
 *
 * @param customTheme - The palette from `UpdateMeDto` (already shape-checked).
 */
export function assertValidCustomTheme(customTheme: CustomThemePayload): void {
  const serializedBytes = Buffer.byteLength(
    JSON.stringify(customTheme),
    'utf8',
  );
  if (serializedBytes > MAX_CUSTOM_THEME_BYTES) {
    throw new BadRequestException(
      `Custom theme is too large (${serializedBytes} bytes; limit is ${MAX_CUSTOM_THEME_BYTES})`,
    );
  }

  for (const modeKey of Object.keys(customTheme)) {
    if (!VALID_MODE_KEYS.has(modeKey)) {
      throw new BadRequestException(
        `Custom theme has an unexpected mode '${modeKey}'; only 'dark' and 'light' are allowed`,
      );
    }

    const palette = customTheme[modeKey as 'dark' | 'light'];
    if (palette === undefined) {
      continue;
    }
    for (const tokenKey of Object.keys(palette)) {
      if (!CUSTOM_THEME_TOKEN_KEYS.has(tokenKey)) {
        throw new BadRequestException(
          `Custom theme has an unknown token '${tokenKey}'`,
        );
      }
    }
  }
}
