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

/** Lets a real jsdom animation frame run, so a deferred write can land. */
async function drainFrames() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete root.dataset.cvd;
  delete root.dataset.theme;
  root.removeAttribute('style');
});

describe('the cvd attribute borrowed for a preview', () => {
  it('comes back when re-entering the theme row cancels the reset', async () => {
    root.dataset.cvd = 'on';
    const { result } = renderHook(() => useThemePreview(vi.fn()));

    act(() => result.current.applyPreview('boyhood'));
    expect(root.dataset.cvd).toBeUndefined();

    act(() => result.current.resetPreview());
    act(() => result.current.handleThemeRowEnter());
    await drainFrames();

    expect(root.dataset.cvd).toBe('on');
  });

  it('comes back when the menu unmounts mid-preview', async () => {
    root.dataset.cvd = 'on';
    const { result, unmount } = renderHook(() => useThemePreview(vi.fn()));

    act(() => result.current.applyPreview('boyhood'));
    unmount();
    await drainFrames();

    expect(root.dataset.cvd).toBe('on');
  });

  it('comes back even when something else repaints the theme first', async () => {
    root.dataset.cvd = 'on';
    const { result } = renderHook(() => useThemePreview(vi.fn()));

    act(() => result.current.applyPreview('boyhood'));
    act(() => result.current.resetPreview());
    root.dataset.theme = 'branding';
    await drainFrames();

    expect(root.dataset.cvd).toBe('on');
  });
});

describe('the return animation', () => {
  it('runs for 600ms and then hands the timing back', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result } = renderHook(() => useThemePreview(vi.fn()));

    act(() => result.current.applyPreview('boyhood'));
    act(() => result.current.resetPreview());
    await drainFrames();

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
