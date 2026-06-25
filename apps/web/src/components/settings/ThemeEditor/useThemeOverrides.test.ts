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
import { useThemeOverrides } from './useThemeOverrides';
import type { CustomTheme } from '../../../theme/customTheme';

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
    // In jsdom the probe resolves nothing, so the read-only mirror is empty —
    // the contract under test is that the style tracks colorValues, not {}.
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
    // An empty custom theme resolves to the branding defaults for every var.
    expect(result.current.contentThemeStyle['--mount-bg']).toBeTruthy();
    expect(result.current.contentThemeStyle['--base-text']).toBeTruthy();
    expect(
      Object.keys(result.current.contentThemeStyle).length,
    ).toBeGreaterThan(10);
  });

  it('setOverride updates colorValues and contentThemeStyle', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    act(() => result.current.setOverride('--mount-bg', '#ffffff'));
    expect(result.current.colorValues['--mount-bg']).toBe('#ffffff');
    expect(result.current.contentThemeStyle['--mount-bg']).toBe('#ffffff');
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

  it('resetBundle reverts only that bundle, preserving other edits', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    act(() => {
      result.current.setOverride('--mount-bg', '#ffffff');
      result.current.setOverride('--alert-text', '#fee2e2');
    });
    act(() => result.current.resetBundle('mount'));
    expect(result.current.colorValues['--mount-bg']).not.toBe('#ffffff');
    expect(result.current.colorValues['--alert-text']).toBe('#fee2e2');
  });

  it('resetBundle base also resets base-only + base/mount-only slots + focus ring', () => {
    const { result } = renderHook(() => useThemeOverrides('light'));
    act(() => {
      result.current.setOverride('--base-bg', '#000000');
      result.current.setOverride('--base-subtle-text', '#888888');
      result.current.setOverride('--base-input-bg', '#111111');
      result.current.setOverride('--focus-ring', '#123456');
    });
    act(() => result.current.resetBundle('base'));
    expect(result.current.colorValues['--base-bg']).not.toBe('#000000');
    expect(result.current.colorValues['--base-subtle-text']).not.toBe(
      '#888888',
    );
    expect(result.current.colorValues['--base-input-bg']).not.toBe('#111111');
    expect(result.current.colorValues['--focus-ring']).not.toBe('#123456');
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
