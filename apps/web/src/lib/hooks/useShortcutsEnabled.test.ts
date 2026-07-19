import { act, render, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  KEYBOARD_SHORTCUTS_KEY,
  setShortcutsEnabled,
  useShortcutsEnabled,
} from './useShortcutsEnabled';

afterEach(() => {
  window.localStorage.clear();
});

describe('useShortcutsEnabled', () => {
  it('defaults to enabled when nothing is stored', () => {
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current).toBe(true);
  });

  it('reads a stored "off" preference on the first committed render, before any effect', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');

    // Record the value seen on every committed render. `useSyncExternalStore`
    // reads the snapshot during render, so the stored "off" is visible on the
    // very first commit. An effect-based regression (useState default of `true`
    // plus a useEffect that reads storage and corrects to `false`) would render
    // `true` first and only settle to `false` after the effect, producing a
    // second render. Locking both the first value and the render count keeps
    // this a real tripwire for the speech-input race.
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
});
