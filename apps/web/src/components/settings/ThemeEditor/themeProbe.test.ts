/*
 * Tests for readThemeTokens – the off-screen probe that reads a theme+mode's
 * resolved tokens. jsdom does NOT apply the [data-theme] stylesheet cascade, so
 * these assert the STRUCTURAL contract (probe mounts with the right dataset,
 * reads every CUSTOM_TOKEN_KEYS entry, allowlist-only output, and cleans up the
 * node), not resolved hex values — those are covered by visual regression.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_TOKEN_KEYS } from '../../../theme/customTheme';
import { readThemeTokens } from './themeProbe';

const realGetComputedStyle = window.getComputedStyle;

beforeEach(() => {
  // Stub getComputedStyle to echo the probe's data-theme/data-mode for every
  // known token, so we can assert the probe was set up correctly per call.
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const dataset = (element as HTMLElement).dataset;
    return {
      getPropertyValue: (property: string) =>
        CUSTOM_TOKEN_KEYS.includes(property)
          ? `value-${dataset.theme}-${dataset.mode}`
          : '',
    } as unknown as CSSStyleDeclaration;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.getComputedStyle = realGetComputedStyle;
});

describe('readThemeTokens', () => {
  it('reads every CUSTOM_TOKEN_KEYS entry for the given theme + mode', () => {
    const tokens = readThemeTokens('boyhood', 'dark');
    expect(Object.keys(tokens).length).toBe(CUSTOM_TOKEN_KEYS.length);
    expect(tokens['--mount-bg']).toBe('value-boyhood-dark');
  });

  it('reads the requested mode independently', () => {
    expect(readThemeTokens('apollo-10-1-2', 'light')['--mount-bg']).toBe(
      'value-apollo-10-1-2-light',
    );
  });

  it('returns only allowlisted token keys', () => {
    const tokens = readThemeTokens('hit-man', 'dark');
    for (const key of Object.keys(tokens)) {
      expect(CUSTOM_TOKEN_KEYS).toContain(key);
    }
  });

  it('removes the probe element from the document after reading', () => {
    const before = document.body.childElementCount;
    readThemeTokens('boyhood', 'light');
    expect(document.body.childElementCount).toBe(before);
    expect(document.querySelector('[data-theme="boyhood"]')).toBeNull();
  });
});
