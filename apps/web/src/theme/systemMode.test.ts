import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSystemMode,
  isFollowingSystemMode,
  useSystemModeSync,
} from './systemMode';
import { MODE_STORAGE_KEY } from './storage';
import {
  restoreSystemColorScheme,
  stubSystemColorScheme,
} from '../../test/systemColorScheme';
import type { Mode } from './constants';

function removeMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

afterEach(() => {
  restoreSystemColorScheme();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('getSystemMode', () => {
  it('reads light when the OS prefers a light scheme', () => {
    stubSystemColorScheme('light');
    expect(getSystemMode()).toBe('light');
  });

  it('reads dark when the OS does not prefer a light scheme', () => {
    stubSystemColorScheme('dark');
    expect(getSystemMode()).toBe('dark');
  });

  it('falls back to dark when matchMedia is unavailable', () => {
    removeMatchMedia();
    expect(getSystemMode()).toBe('dark');
  });
});

describe('isFollowingSystemMode', () => {
  it('is true when the painted mode equals the OS preference', () => {
    stubSystemColorScheme('light');
    expect(isFollowingSystemMode('light')).toBe(true);
  });

  it('is false when the painted mode differs from the OS preference', () => {
    stubSystemColorScheme('light');
    expect(isFollowingSystemMode('dark')).toBe(false);
  });

  it('ignores a stored mode a sibling tab moved', () => {
    stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    expect(isFollowingSystemMode('light')).toBe(false);
  });

  it('is true on a device that has never stored a mode', () => {
    stubSystemColorScheme('dark');
    expect(isFollowingSystemMode('dark')).toBe(true);
  });
});

describe('useSystemModeSync', () => {
  it('adopts the OS value in both directions', () => {
    const system = stubSystemColorScheme('dark');
    const adopted: Mode[] = [];
    renderHook(() =>
      useSystemModeSync((systemMode) => adopted.push(systemMode)),
    );

    act(() => system.flip('light'));
    act(() => system.flip('dark'));

    expect(adopted).toEqual(['light', 'dark']);
  });

  it('removes its listener on unmount', () => {
    const system = stubSystemColorScheme('dark');
    const { unmount } = renderHook(() => useSystemModeSync(() => undefined));
    expect(system.listenerCount()).toBe(1);

    unmount();

    expect(system.listenerCount()).toBe(0);
  });

  it('does nothing when matchMedia is unavailable', () => {
    removeMatchMedia();
    const adopt = vi.fn();

    expect(() => renderHook(() => useSystemModeSync(adopt))).not.toThrow();
    expect(adopt).not.toHaveBeenCalled();
  });
});
