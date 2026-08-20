/*
 * What the hook owns by itself: the `data-cvd` it borrows for a preview,
 * and the properties that time the return animation. Painting is the
 * provider's, and lives in `index.themePreview.test.tsx` — as does the
 * picker guard that keeps the cvd borrow out of a real user's reach.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useThemePreview } from './useThemePreview';

const root = document.documentElement;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete root.dataset.cvd;
  delete root.dataset.theme;
  root.removeAttribute('style');
});

describe('the cvd attribute borrowed for a preview', () => {
  it('comes back when re-entering the theme row cancels the reset', () => {
    root.dataset.cvd = 'on';
    const { result } = renderHook(() => useThemePreview(vi.fn()));

    act(() => result.current.applyPreview('boyhood'));
    expect(root.dataset.cvd).toBeUndefined();

    act(() => result.current.resetPreview());
    act(() => result.current.handleThemeRowEnter());

    expect(root.dataset.cvd).toBe('on');
  });

  it('comes back when the menu unmounts mid-preview', () => {
    root.dataset.cvd = 'on';
    const { result, unmount } = renderHook(() => useThemePreview(vi.fn()));

    act(() => result.current.applyPreview('boyhood'));
    unmount();

    expect(root.dataset.cvd).toBe('on');
  });

  it('comes back even when something else repaints the theme first', () => {
    root.dataset.cvd = 'on';
    const { result } = renderHook(() => useThemePreview(vi.fn()));

    act(() => result.current.applyPreview('boyhood'));
    act(() => result.current.resetPreview());
    root.dataset.theme = 'branding';

    expect(root.dataset.cvd).toBe('on');
  });
});

describe('the return animation', () => {
  it('is timed before the preview clears, not after', () => {
    const durationsWhenPainted: string[] = [];
    const setPreviewTheme = vi.fn(() => {
      durationsWhenPainted.push(
        root.style.getPropertyValue('--theme-transition-duration'),
      );
    });
    const { result } = renderHook(() => useThemePreview(setPreviewTheme));

    act(() => result.current.applyPreview('boyhood'));
    act(() => result.current.resetPreview());

    expect(durationsWhenPainted).toEqual(['150ms', '600ms']);
  });

  it('runs for 600ms and then hands the timing back', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result } = renderHook(() => useThemePreview(vi.fn()));

    act(() => result.current.applyPreview('boyhood'));
    act(() => result.current.resetPreview());

    expect(root.style.getPropertyValue('--theme-transition-duration')).toBe(
      '600ms',
    );

    act(() => vi.advanceTimersByTime(649));
    expect(root.style.getPropertyValue('--theme-transition-duration')).toBe(
      '600ms',
    );

    act(() => vi.advanceTimersByTime(2));
    expect(root.style.getPropertyValue('--theme-transition-duration')).toBe('');
    expect(root.style.getPropertyValue('--theme-transition-easing')).toBe('');
  });
});
