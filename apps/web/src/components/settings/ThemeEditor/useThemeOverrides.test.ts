/*
 * Tests for useThemeOverrides – the theme editor's live-edit state hook.
 *
 * It NEVER mutates document.documentElement / the global theme, and its mode is
 * a LOCAL `editorMode` argument (the Light/Dark tabs), decoupled from the site
 * mode. While ENABLED the baseline is the resolved custom palette for that mode;
 * while DISABLED it mirrors the current theme's `editorMode` palette via a probe
 * (empty in jsdom, where the probe can't resolve the cascade). Either way
 * `contentThemeStyle` is just `colorValues`, so the tabs repaint the scoped
 * subtree without touching the global theme.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAlphaValue, useThemeOverrides } from './useThemeOverrides';
import type { CSSProperties } from 'react';
import type { CustomTheme } from '../../../theme/customTheme';

/**
 * Reads a custom property off the inline style object. `CSSProperties`
 * has no index signature for them, so the cast is what lets a test ask
 * about the tokens this hook exists to set.
 */
function contentValue(style: CSSProperties, token: string): string | undefined {
  return (style as Record<string, string | undefined>)[token];
}

const mockTheme = {
  baseTheme: 'apollo-10-1-2',
  mode: 'light' as 'light' | 'dark',
  customTheme: null as CustomTheme | null,
  customThemeEnabled: false,
  setBaseTheme: vi.fn(),
  setMode: vi.fn(),
};

vi.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

beforeEach(() => {
  Object.assign(mockTheme, {
    mode: 'light',
    customTheme: null,
    customThemeEnabled: false,
  });
  for (const property of Array.from(document.documentElement.style)) {
    if (property.startsWith('--')) {
      document.documentElement.style.removeProperty(property);
    }
  }
});

describe('useThemeOverrides – disabled (custom theme off)', () => {
  it('contentThemeStyle mirrors colorValues so the tabs repaint the preview', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    // in jsdom the probe is empty; the contract is style tracks colorValues, not {}
    expect(result.current.contentThemeStyle).toEqual(
      result.current.colorValues,
    );
  });

  it('never mutates document.documentElement.style while disabled', () => {
    renderHook(() => useThemeOverrides('dark'));
    expect(document.documentElement.style.getPropertyValue('--mount-bg')).toBe(
      '',
    );
  });
});

describe('useThemeOverrides – enabled (editing the custom theme)', () => {
  beforeEach(() => {
    Object.assign(mockTheme, {
      customThemeEnabled: true,
      customTheme: { dark: {}, light: {} },
    });
  });

  it('contentThemeStyle carries the full resolved palette (branding fallback)', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    // an empty custom theme resolves to the branding defaults for every var
    expect(
      contentValue(result.current.contentThemeStyle, '--mount-bg'),
    ).toBeTruthy();
    expect(
      contentValue(result.current.contentThemeStyle, '--base-text'),
    ).toBeTruthy();
    expect(
      Object.keys(result.current.contentThemeStyle).length,
    ).toBeGreaterThan(10);
  });

  it('setOverride updates colorValues and contentThemeStyle', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    act(() => result.current.setOverride('--mount-bg', '#ffffff'));
    expect(result.current.colorValues['--mount-bg']).toBe('#ffffff');
    expect(contentValue(result.current.contentThemeStyle, '--mount-bg')).toBe(
      '#ffffff',
    );
  });

  it('accumulates multiple overrides without dropping prior keys', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    act(() => result.current.setOverride('--mount-bg', '#ffffff'));
    act(() => result.current.setOverride('--alert-text', '#fee2e2'));
    expect(result.current.colorValues['--mount-bg']).toBe('#ffffff');
    expect(result.current.colorValues['--alert-text']).toBe('#fee2e2');
  });

  it('resetOverrides reverts every edit to the baseline', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    act(() => result.current.setOverride('--mount-bg', '#ffffff'));
    act(() => result.current.resetOverrides());
    expect(result.current.colorValues['--mount-bg']).not.toBe('#ffffff');
    expect(result.current.colorValues['--mount-bg']).toBeTruthy();
  });

  it('loadOverrides seeds the copied keys; un-copied keys keep their value', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    act(() => result.current.setOverride('--mount-bg', '#abcdef'));
    // A real copy resolves the full key set; a partial map keeps the rest.
    act(() => result.current.loadOverrides({ '--alert-text': '#fee2e2' }));
    expect(result.current.colorValues['--alert-text']).toBe('#fee2e2');
    expect(result.current.colorValues['--mount-bg']).toBe('#abcdef');
  });

  it('never mutates document.documentElement.style', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    act(() => result.current.setOverride('--mount-bg', '#ffffff'));
    expect(document.documentElement.style.getPropertyValue('--mount-bg')).toBe(
      '',
    );
  });
});

/*
 * One answer decides two things a row shows: whether the native picker
 * is offered, and whether the swatch paints the value or the picker's
 * fallback. A shape missed here is a picker live on a value it cannot
 * hold, above a swatch showing a color the token is nowhere near.
 */
describe('isAlphaValue – shapes the native picker cannot hold', () => {
  it.each([
    '#abcd',
    '#ABCD',
    '#0000ff80',
    'rgb(76 5 25 / 0.4)',
    'rgba(0,0,0,1)',
  ])('refuses the picker for %s', (value) => {
    expect(isAlphaValue(value)).toBe(true);
  });

  it.each(['#aabbcc', '#abc', '#ABCDEF'])(
    'keeps the picker for %s',
    (value) => {
      expect(isAlphaValue(value)).toBe(false);
    },
  );
});
