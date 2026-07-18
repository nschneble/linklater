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
    const giant = '#' + 'a'.repeat(MAX_CUSTOM_THEME_BYTES);
    expect(() =>
      assertValidCustomTheme({ dark: { '--base-bg': giant } }),
    ).toThrow(BadRequestException);
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
