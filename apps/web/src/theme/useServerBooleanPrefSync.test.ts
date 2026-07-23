/*
 * Tests for useServerBooleanPrefSync, the shared App-level hook that syncs a
 * boolean user preference (CVD mode, dyslexic font) from the server into
 * ThemeContext. It covers the four decision branches plus the two guards: the
 * 30s optimistic-toggle timestamp guard and the local `'on'` disable guard.
 */

import { RECENT_LOCAL_CHANGE_MS } from './storage';
import { renderHook } from '@testing-library/react';
import { useServerBooleanPrefSync } from './useServerBooleanPrefSync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const UPDATED_AT_KEY = 'test_pref_updated_at';
const VALUE_KEY = 'test_pref';
const storageKeys = { updatedAtKey: UPDATED_AT_KEY, valueKey: VALUE_KEY };

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useServerBooleanPrefSync', () => {
  it('does nothing while the server value is undefined (no user yet)', () => {
    const enable = vi.fn();
    const disable = vi.fn();

    renderHook(() =>
      useServerBooleanPrefSync(undefined, false, enable, disable, storageKeys),
    );

    expect(enable).not.toHaveBeenCalled();
    expect(disable).not.toHaveBeenCalled();
  });

  it('enables when the server is on and local state is off', () => {
    const enable = vi.fn();
    const disable = vi.fn();

    renderHook(() =>
      useServerBooleanPrefSync(true, false, enable, disable, storageKeys),
    );

    expect(enable).toHaveBeenCalledTimes(1);
    expect(disable).not.toHaveBeenCalled();
  });

  it('disables when the server is off and local state disagrees', () => {
    const enable = vi.fn();
    const disable = vi.fn();

    renderHook(() =>
      useServerBooleanPrefSync(false, true, enable, disable, storageKeys),
    );

    expect(disable).toHaveBeenCalledTimes(1);
    expect(enable).not.toHaveBeenCalled();
  });

  it('does not disable when the local value is still `on`', () => {
    window.localStorage.setItem(VALUE_KEY, 'on');
    const enable = vi.fn();
    const disable = vi.fn();

    renderHook(() =>
      useServerBooleanPrefSync(false, true, enable, disable, storageKeys),
    );

    expect(disable).not.toHaveBeenCalled();
    expect(enable).not.toHaveBeenCalled();
  });

  it('skips the sync within the 30s optimistic-toggle guard window', () => {
    window.localStorage.setItem(UPDATED_AT_KEY, String(Date.now()));
    const enable = vi.fn();
    const disable = vi.fn();

    renderHook(() =>
      useServerBooleanPrefSync(true, false, enable, disable, storageKeys),
    );

    expect(enable).not.toHaveBeenCalled();
    expect(disable).not.toHaveBeenCalled();
  });

  it('applies the sync once the guard window has elapsed', () => {
    window.localStorage.setItem(
      UPDATED_AT_KEY,
      String(Date.now() - RECENT_LOCAL_CHANGE_MS - 1),
    );
    const enable = vi.fn();
    const disable = vi.fn();

    renderHook(() =>
      useServerBooleanPrefSync(true, false, enable, disable, storageKeys),
    );

    expect(enable).toHaveBeenCalledTimes(1);
  });
});
