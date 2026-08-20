import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';

import {
  KEYBOARD_SHORTCUTS_KEY,
  setShortcutsEnabled,
  useShortcutsEnabled,
} from './useShortcutsEnabled';
import { resetShortcutsPreference } from '../../../test/shortcutsPreference';
import { withRefusedStorage } from '../../../test/refusedStorage';

beforeEach(resetShortcutsPreference);

describe('resetShortcutsPreference', () => {
  it('empties the store rather than leaving the default it just wrote', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');

    resetShortcutsPreference();

    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBeNull();
  });
});

describe('useShortcutsEnabled', () => {
  let freshModule: typeof import('./useShortcutsEnabled') | null = null;

  afterEach(() => {
    freshModule?.stopCrossTabShortcutsSync();
    freshModule = null;
  });

  it('defaults to enabled when nothing is stored', () => {
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current).toBe(true);
  });

  it('reads a stored "off" preference on the first committed render, before any effect', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');

    // tripwire: an effect-based read renders true first, then re-renders
    const committedRenders: boolean[] = [];
    function Probe() {
      committedRenders.push(useShortcutsEnabled());
      return null;
    }

    render(createElement(Probe));

    expect(committedRenders[0]).toBe(false);
    expect(committedRenders).toHaveLength(1);
  });

  it('reflects a stored "on" preference', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'on');
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current).toBe(true);
  });

  it('re-renders subscribers when the preference is turned off', () => {
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current).toBe(true);

    act(() => setShortcutsEnabled(false));
    expect(result.current).toBe(false);

    act(() => setShortcutsEnabled(true));
    expect(result.current).toBe(true);
  });

  it('persists the preference to localStorage', () => {
    act(() => setShortcutsEnabled(false));
    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBe('off');

    act(() => setShortcutsEnabled(true));
    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBe('on');
  });

  it('seeds enabled at module load when the store is empty', async () => {
    window.localStorage.clear();
    vi.resetModules();
    const loadedModule = await import('./useShortcutsEnabled');
    freshModule = loadedModule;

    const { result } = renderHook(() => loadedModule.useShortcutsEnabled());

    expect(result.current).toBe(true);
  });

  it('seeds its in-memory copy at module load, not on first use', async () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');
    vi.resetModules();
    const loadedModule = await import('./useShortcutsEnabled');
    freshModule = loadedModule;
    window.localStorage.clear();

    const { result } = renderHook(() => loadedModule.useShortcutsEnabled());

    expect(result.current).toBe(false);
  });
});

describe('useShortcutsEnabled against a store that refuses writes', () => {
  it('holds the disable a refused write could not persist', () => {
    const { result } = renderHook(() => useShortcutsEnabled());

    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(false)),
      'localStorage',
    );

    expect(result.current).toBe(false);
  });

  it('holds the disable when the refused write left an older "on" stored', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'on');
    const { result } = renderHook(() => useShortcutsEnabled());

    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(false)),
      'localStorage',
    );

    expect(result.current).toBe(false);
  });

  it('reads a refused disable on the first committed render, before any effect', () => {
    withRefusedStorage(
      'setItem',
      () => setShortcutsEnabled(false),
      'localStorage',
    );

    const committedRenders: boolean[] = [];
    function Probe() {
      committedRenders.push(useShortcutsEnabled());
      return null;
    }

    render(createElement(Probe));

    expect(committedRenders[0]).toBe(false);
    expect(committedRenders).toHaveLength(1);
  });

  it("adopts another tab's value over the refusal it is holding", () => {
    const { result } = renderHook(() => useShortcutsEnabled());
    withRefusedStorage(
      'setItem',
      () => act(() => setShortcutsEnabled(false)),
      'localStorage',
    );
    expect(result.current).toBe(false);

    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'on');
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: KEYBOARD_SHORTCUTS_KEY,
          newValue: 'on',
        }),
      );
    });

    expect(result.current).toBe(true);

    window.localStorage.removeItem(KEYBOARD_SHORTCUTS_KEY);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: KEYBOARD_SHORTCUTS_KEY }),
      );
    });

    expect(result.current).toBe(true);
  });
});
