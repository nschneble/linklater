/*
 * Tests for useThemeOverrides — the theme editor's live-edit state hook.
 *
 * The hook owns the override map as React state and exposes an
 * `overrideStyle` object the consumer spreads onto a wrapper element.
 * Critically, it does NOT mutate document.documentElement.style — the
 * editor chrome reads from :root, so the user can never lock themselves
 * out by editing a bundle slot to an unreadable value.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useThemeOverrides } from './useThemeOverrides';

vi.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({
    baseTheme: 'apollo-10-1-2',
    mode: 'light',
    setBaseTheme: vi.fn(),
    setMode: vi.fn(),
  }),
}));

afterEach(() => {
  // Belt-and-braces: confirm no inline custom properties leaked onto :root
  // across tests. Cleared by the test isolation regardless.
  for (const property of Array.from(document.documentElement.style)) {
    if (property.startsWith('--')) {
      document.documentElement.style.removeProperty(property);
    }
  }
});

describe('useThemeOverrides', () => {
  it('returns an empty overrideStyle when no overrides are set', () => {
    const { result } = renderHook(() => useThemeOverrides());
    expect(result.current.overrideStyle).toEqual({});
  });

  it('returns only the overridden variables in overrideStyle', () => {
    const { result } = renderHook(() => useThemeOverrides());
    act(() => {
      result.current.setOverride('--mount-bg', '#ffffff');
    });
    expect(result.current.overrideStyle).toEqual({ '--mount-bg': '#ffffff' });
  });

  it('accumulates multiple overrides without dropping prior keys', () => {
    const { result } = renderHook(() => useThemeOverrides());
    act(() => {
      result.current.setOverride('--mount-bg', '#ffffff');
    });
    act(() => {
      result.current.setOverride('--alert-text', '#fee2e2');
    });
    expect(result.current.overrideStyle).toEqual({
      '--mount-bg': '#ffffff',
      '--alert-text': '#fee2e2',
    });
  });

  it('clears every override on resetOverrides', () => {
    const { result } = renderHook(() => useThemeOverrides());
    act(() => {
      result.current.setOverride('--mount-bg', '#ffffff');
      result.current.setOverride('--alert-text', '#fee2e2');
    });
    act(() => {
      result.current.resetOverrides();
    });
    expect(result.current.overrideStyle).toEqual({});
  });

  it('clears only the targeted bundle on resetBundle', () => {
    const { result } = renderHook(() => useThemeOverrides());
    act(() => {
      result.current.setOverride('--mount-bg', '#ffffff');
      result.current.setOverride('--alert-text', '#fee2e2');
    });
    act(() => {
      result.current.resetBundle('mount');
    });
    expect(result.current.overrideStyle).toEqual({
      '--alert-text': '#fee2e2',
    });
  });

  it('clears base-only and base/mount-only slots when resetting base', () => {
    const { result } = renderHook(() => useThemeOverrides());
    act(() => {
      result.current.setOverride('--base-bg', '#000000');
      result.current.setOverride('--base-subtle-text', '#888888');
      result.current.setOverride('--base-input-bg', '#111111');
    });
    act(() => {
      result.current.resetBundle('base');
    });
    expect(result.current.overrideStyle).toEqual({});
  });

  it('clears mount-only input-bg when resetting mount', () => {
    const { result } = renderHook(() => useThemeOverrides());
    act(() => {
      result.current.setOverride('--mount-input-bg', '#222222');
    });
    act(() => {
      result.current.resetBundle('mount');
    });
    expect(result.current.overrideStyle).toEqual({});
  });

  it('exposes overridden colorValues alongside non-overridden defaults', () => {
    const { result } = renderHook(() => useThemeOverrides());
    act(() => {
      result.current.setOverride('--mount-bg', '#abcdef');
    });
    expect(result.current.colorValues['--mount-bg']).toBe('#abcdef');
    // Other variables retain whatever defaults the test environment reports
    // (jsdom returns empty strings; the precise value doesn't matter — just
    // that the override slot is the one that flipped).
    expect(result.current.colorValues['--alert-bg']).not.toBe('#abcdef');
  });

  it('never mutates document.documentElement.style', () => {
    const { result } = renderHook(() => useThemeOverrides());
    act(() => {
      result.current.setOverride('--mount-bg', '#ffffff');
    });
    expect(document.documentElement.style.getPropertyValue('--mount-bg')).toBe(
      '',
    );
  });
});
