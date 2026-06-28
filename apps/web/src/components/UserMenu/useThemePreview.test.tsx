/*
 * Tests the Custom-theme interaction of useThemePreview: previewing a CSS-file
 * theme while Custom is active must clear the inline Custom tokens (which
 * otherwise outrank the stylesheet and bleed over every preview), and
 * previewing Custom must apply them.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { applyCustomThemeTokens } from '../../theme/customTheme';
import { useThemePreview } from './useThemePreview';
import type { CustomTheme } from '../../theme/ThemeContext';

const CUSTOM: CustomTheme = {
  dark: { '--base-bg': '#abcabc' },
  light: {},
};

afterEach(() => {
  const root = document.documentElement;
  delete root.dataset.theme;
  root.removeAttribute('style');
});

describe('useThemePreview Custom-token sync', () => {
  it('clears the inline Custom tokens when previewing another theme', () => {
    // Simulate the active Custom theme having injected its inline tokens.
    applyCustomThemeTokens(document.documentElement, CUSTOM, 'dark');
    expect(document.documentElement.style.getPropertyValue('--base-bg')).toBe(
      '#abcabc',
    );

    const { result } = renderHook(() => useThemePreview(CUSTOM, 'dark'));
    act(() => result.current.applyPreview('scanner-darkly'));

    expect(document.documentElement.dataset.theme).toBe('scanner-darkly');
    // The Custom inline token is gone, so the previewed theme's stylesheet wins.
    expect(document.documentElement.style.getPropertyValue('--base-bg')).toBe(
      '',
    );
  });

  it('applies the Custom palette when previewing Custom from another theme', () => {
    const { result } = renderHook(() => useThemePreview(CUSTOM, 'dark'));
    act(() => result.current.applyPreview('custom'));

    expect(document.documentElement.dataset.theme).toBe('custom');
    expect(document.documentElement.style.getPropertyValue('--base-bg')).toBe(
      '#abcabc',
    );
  });
});
