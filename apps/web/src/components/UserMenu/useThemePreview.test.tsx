/*
 * Tests the Custom-theme interaction of useThemePreview: previewing a CSS-file
 * theme while Custom is active must clear the inline Custom tokens (which
 * otherwise outrank the stylesheet and bleed over every preview), and
 * previewing Custom must apply them.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    // simulate the active Custom theme having injected its inline tokens
    applyCustomThemeTokens(document.documentElement, CUSTOM, 'dark');
    expect(document.documentElement.style.getPropertyValue('--base-bg')).toBe(
      '#abcabc',
    );

    const { result } = renderHook(() => useThemePreview(CUSTOM, 'dark'));
    act(() => result.current.applyPreview('scanner-darkly'));

    expect(document.documentElement.dataset.theme).toBe('scanner-darkly');
    // the Custom inline token is gone, so the preview stylesheet wins
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

describe('useThemePreview reset does not stomp an authoritative repaint', () => {
  it('no-ops the deferred restore when logout repainted branding first', () => {
    // mock reset rAF to interleave a branding repaint (the logout race order)
    let scheduled: FrameRequestCallback | null = null;
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        scheduled = callback;
        return 1;
      });

    const { result } = renderHook(() => useThemePreview(null, 'dark'));

    // hover a theme → preview paints imperatively
    act(() => result.current.applyPreview('boyhood'));
    expect(document.documentElement.dataset.theme).toBe('boyhood');

    // mouse away → schedules the deferred restore to the committed theme
    act(() => result.current.resetPreview('school-of-rock'));

    // logout: the unauthenticated gate repaints branding before the rAF fires
    document.documentElement.dataset.theme = 'branding';

    // the deferred restore now fires; it must NOT clobber branding
    act(() => {
      scheduled?.(0);
    });

    expect(document.documentElement.dataset.theme).toBe('branding');

    rafSpy.mockRestore();
  });

  it('still restores the committed theme when nothing repainted', () => {
    let scheduled: FrameRequestCallback | null = null;
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        scheduled = callback;
        return 1;
      });

    const { result } = renderHook(() => useThemePreview(null, 'dark'));

    act(() => result.current.applyPreview('boyhood'));
    act(() => result.current.resetPreview('school-of-rock'));

    // no competing repaint: the preview is still on screen when the rAF fires
    act(() => {
      scheduled?.(0);
    });

    expect(document.documentElement.dataset.theme).toBe('school-of-rock');

    rafSpy.mockRestore();
  });
});
