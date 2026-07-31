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
    // oversized AND an invalid key: size guard must run before the key check
    const giant = '#' + 'a'.repeat(MAX_CUSTOM_THEME_BYTES);
    expect(() =>
      assertValidCustomTheme({ dark: { '--not-a-real-token': giant } }),
    ).toThrow(/too large/i);
  });

  it('accepts a payload of exactly MAX_CUSTOM_THEME_BYTES and rejects one byte over', () => {
    // size check is strict `>`; `>=` would wrongly reject the at-limit payload
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
    // JSON.parse makes a real own `__proto__`, unlike an object literal
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
    // 49 (7 bundles x 7 slots) + subtle-text, base/mount input-bg, focus ring
    expect(CUSTOM_THEME_TOKEN_KEYS.size).toBe(53);
    expect(CUSTOM_THEME_TOKEN_KEYS.has('--success-highlight-fg')).toBe(true);
    expect(CUSTOM_THEME_TOKEN_KEYS.has('--base-subtle-text')).toBe(true);
    expect(CUSTOM_THEME_TOKEN_KEYS.has('--mount-input-bg')).toBe(true);
    expect(CUSTOM_THEME_TOKEN_KEYS.has('--focus-ring')).toBe(true);
  });
});
