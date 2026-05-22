import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MODE_STORAGE_KEY,
  readLocalStorage,
  THEME_STORAGE_KEY,
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
