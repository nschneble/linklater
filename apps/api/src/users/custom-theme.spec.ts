import { BadRequestException } from '@nestjs/common';
import {
  CUSTOM_THEME_TOKEN_KEYS,
  MAX_CUSTOM_THEME_BYTES,
  assertValidCustomTheme,
} from './custom-theme.js';

describe('assertValidCustomTheme', () => {
  it('accepts a palette of known token keys in both modes', () => {
    expect(() =>
      assertValidCustomTheme({
        dark: { '--mount-border': '#102030', '--base-bg': '#000000' },
        light: { '--mount-border': '#fefefe', '--focus-ring': '#123456' },
      }),
    ).not.toThrow();
  });

  it('accepts an empty payload', () => {
    expect(() => assertValidCustomTheme({})).not.toThrow();
  });

  it('accepts a single-mode partial save', () => {
    expect(() =>
      assertValidCustomTheme({ dark: { '--base-bg': '#000000' } }),
    ).not.toThrow();
  });

  it('accepts every canonical token key', () => {
    const palette = Object.fromEntries(
      [...CUSTOM_THEME_TOKEN_KEYS].map((key) => [key, '#000000']),
    );
    expect(() => assertValidCustomTheme({ dark: palette })).not.toThrow();
  });

  it('rejects an unknown token key', () => {
    expect(() =>
      assertValidCustomTheme({ dark: { '--evil-token': 'red' } }),
    ).toThrow(BadRequestException);
  });

  it('rejects a token key that smuggles a CSS injection', () => {
    expect(() =>
      assertValidCustomTheme({
        light: { '--mount-border: red; background: url(x)': 'red' },
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects an unexpected top-level mode key', () => {
    const payloadWithExtraKey = {
      dark: { '--base-bg': '#000000' },
      evil: { '--base-bg': '#ffffff' },
    } as unknown as Parameters<typeof assertValidCustomTheme>[0];
    expect(() => assertValidCustomTheme(payloadWithExtraKey)).toThrow(
      BadRequestException,
    );
  });

  it('rejects an oversized payload before inspecting keys', () => {
    // Oversized AND carrying an invalid token key: the size guard must run
    // first, so the thrown message is about size, not the unknown key. This
    // proves ordering, not merely that an oversized payload is rejected.
    const giant = '#' + 'a'.repeat(MAX_CUSTOM_THEME_BYTES);
    expect(() =>
      assertValidCustomTheme({ dark: { '--not-a-real-token': giant } }),
    ).toThrow(/too large/i);
  });

  it('accepts a payload of exactly MAX_CUSTOM_THEME_BYTES and rejects one byte over', () => {
    // The size check is a strict `>`, so the limit itself must be accepted.
    // Sizing the value from the measured overhead pins both sides of the
    // boundary: a flip to `>=` would reject the at-limit payload and fail here.
    const overheadBytes = Buffer.byteLength(
      JSON.stringify({ dark: { '--base-bg': '' } }),
      'utf8',
    );
    const atLimitValue = 'a'.repeat(MAX_CUSTOM_THEME_BYTES - overheadBytes);

    const atLimit = { dark: { '--base-bg': atLimitValue } };
    expect(Buffer.byteLength(JSON.stringify(atLimit), 'utf8')).toBe(
      MAX_CUSTOM_THEME_BYTES,
    );
    expect(() => assertValidCustomTheme(atLimit)).not.toThrow();

    const overLimit = { dark: { '--base-bg': atLimitValue + 'a' } };
    expect(Buffer.byteLength(JSON.stringify(overLimit), 'utf8')).toBe(
      MAX_CUSTOM_THEME_BYTES + 1,
    );
    expect(() => assertValidCustomTheme(overLimit)).toThrow(
      BadRequestException,
    );
  });

  it('rejects __proto__ as a top-level mode key', () => {
    // JSON.parse creates a real own `__proto__` property (unlike an object
    // literal, which would set the prototype instead), so this exercises the
    // guard the way a crafted request body actually arrives.
    const payload = JSON.parse('{"__proto__":{"--base-bg":"#000000"}}');
    expect(() => assertValidCustomTheme(payload)).toThrow(BadRequestException);
  });

  it('rejects __proto__ and constructor as token keys', () => {
    const protoTokenKey = JSON.parse('{"dark":{"__proto__":"#000000"}}');
    expect(() => assertValidCustomTheme(protoTokenKey)).toThrow(
      BadRequestException,
    );

    const constructorTokenKey = JSON.parse(
      '{"dark":{"constructor":"#000000"}}',
    );
    expect(() => assertValidCustomTheme(constructorTokenKey)).toThrow(
      BadRequestException,
    );
  });

  it('exposes the full 53-token vocabulary mirrored from the web editor', () => {
    // 7 bundles x 7 slots = 49, plus base subtle-text, base/mount input-bg,
    // and the universal focus ring.
    expect(CUSTOM_THEME_TOKEN_KEYS.size).toBe(53);
    expect(CUSTOM_THEME_TOKEN_KEYS.has('--success-highlight-fg')).toBe(true);
    expect(CUSTOM_THEME_TOKEN_KEYS.has('--base-subtle-text')).toBe(true);
    expect(CUSTOM_THEME_TOKEN_KEYS.has('--mount-input-bg')).toBe(true);
    expect(CUSTOM_THEME_TOKEN_KEYS.has('--focus-ring')).toBe(true);
  });
});
