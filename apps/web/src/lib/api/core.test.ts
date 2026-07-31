import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Builds a minimal `localStorage` stub. Each method defaults to a no-op so
 * tests only need to override the one method under test.
 */
function makeStorageStub(overrides: Partial<Storage> = {}): Storage {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
    ...overrides,
  } as Storage;
}

/**
 * Verifies that `core.ts` survives module load when `localStorage` throws on
 * read; Safari private browsing and storage-blocked sites throw a
 * `SecurityError` on every access. A naked `localStorage.getItem` call at
 * module top-level would have broken the entire app under those conditions.
 *
 * The module is re-imported per test so the top-level `safeRead` runs under
 * the mocked storage. `vi.resetModules()` clears the cache between tests.
 */
describe('core.ts storage safety', () => {
  let originalLocalStorage: typeof window.localStorage;

  beforeEach(() => {
    originalLocalStorage = window.localStorage;
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('imports successfully when localStorage.getItem throws', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: makeStorageStub({
        getItem: () => {
          throw new Error('SecurityError: access denied');
        },
      }),
    });

    const module_ = await import('./core');
    expect(module_.getStoredToken()).toBeNull();
    expect(module_.getStoredRefreshToken()).toBeNull();
  });

  it('does not throw when setStoredToken is called with broken storage', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: makeStorageStub({
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      }),
    });

    const module_ = await import('./core');
    expect(() =>
      module_.setStoredToken('access-token', 'refresh-token'),
    ).not.toThrow();
    // in-memory copy is still updated so the session keeps working
    expect(module_.getStoredToken()).toBe('access-token');
    expect(module_.getStoredRefreshToken()).toBe('refresh-token');
  });

  it('does not throw when clearStoredToken is called with broken storage', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: makeStorageStub({
        removeItem: () => {
          throw new Error('SecurityError: access denied');
        },
      }),
    });

    const module_ = await import('./core');
    module_.setStoredToken('access-token', 'refresh-token');
    expect(() => module_.clearStoredToken()).not.toThrow();
    expect(module_.getStoredToken()).toBeNull();
    expect(module_.getStoredRefreshToken()).toBeNull();
  });
});
