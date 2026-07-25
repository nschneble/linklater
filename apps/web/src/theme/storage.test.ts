import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasRecentLocalChange,
  MODE_STORAGE_KEY,
  persistWithTimestamp,
  readLocalStorage,
  RECENT_LOCAL_CHANGE_MS,
  THEME_STORAGE_KEY,
  THEME_UPDATED_AT_KEY,
} from './storage';

describe('readLocalStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('returns the stored value when localStorage has the key', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'scanner-darkly');
    expect(readLocalStorage(THEME_STORAGE_KEY)).toBe('scanner-darkly');
  });

  it('returns null when the key has not been set', () => {
    expect(readLocalStorage(MODE_STORAGE_KEY)).toBeNull();
  });

  it('returns null when localStorage throws (private browsing / blocked storage)', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError: localStorage is blocked');
    });
    expect(readLocalStorage(THEME_STORAGE_KEY)).toBeNull();
  });

  it('returns null when window is undefined (SSR guard)', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error -- deliberately removing the global to exercise the SSR branch
    delete globalThis.window;
    try {
      expect(readLocalStorage(THEME_STORAGE_KEY)).toBeNull();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});

describe('hasRecentLocalChange', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns true when the timestamp is within the guard window', () => {
    window.localStorage.setItem(THEME_UPDATED_AT_KEY, String(Date.now()));
    expect(hasRecentLocalChange(THEME_UPDATED_AT_KEY)).toBe(true);
  });

  it('returns false once the timestamp is older than the guard window', () => {
    window.localStorage.setItem(
      THEME_UPDATED_AT_KEY,
      String(Date.now() - RECENT_LOCAL_CHANGE_MS - 1),
    );
    expect(hasRecentLocalChange(THEME_UPDATED_AT_KEY)).toBe(false);
  });

  it('returns false when no timestamp has been stored', () => {
    expect(hasRecentLocalChange(THEME_UPDATED_AT_KEY)).toBe(false);
  });
});

describe('persistWithTimestamp', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('writes the value under valueKey and a timestamp under updatedAtKey', () => {
    const before = Date.now();
    persistWithTimestamp(THEME_STORAGE_KEY, 'boyhood', THEME_UPDATED_AT_KEY);

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('boyhood');

    const stamped = Number(window.localStorage.getItem(THEME_UPDATED_AT_KEY));
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });

  it('stamps a fresh time inside the guard window', () => {
    persistWithTimestamp(THEME_STORAGE_KEY, 'boyhood', THEME_UPDATED_AT_KEY);
    expect(hasRecentLocalChange(THEME_UPDATED_AT_KEY)).toBe(true);
  });
});
