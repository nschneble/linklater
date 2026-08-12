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

const TOKEN_KEY = 'linklater_token';
const REFRESH_TOKEN_KEY = 'linklater_refresh_token';

/**
 * Verifies that a token pair rotated in one tab reaches every other tab of
 * the same origin. The `storage` event never fires in the tab that wrote,
 * so the other tab is simulated here by writing to the real
 * `window.localStorage` and dispatching a `StorageEvent` by hand.
 *
 * Two mechanisms are pinned separately: the read-through (tested with the
 * listener detached) and the listener (tested with reads broken, so only
 * a cache the listener refreshed can answer).
 *
 * The module is re-imported per test so its module-level state starts
 * clean; the listener it registers is torn down in `afterEach`.
 */
describe('storage.ts cross-tab token sync', () => {
  let originalLocalStorage: typeof window.localStorage;
  let storageModule: typeof import('./storage') | null = null;

  async function loadStorageModule(): Promise<typeof import('./storage')> {
    vi.resetModules();
    storageModule = await import('./storage');
    return storageModule;
  }

  function breakStorageReads(): void {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: makeStorageStub({
        getItem: () => {
          throw new Error('SecurityError: access denied');
        },
      }),
    });
  }

  function writeInAnotherTab(key: string, value: string | null): void {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
  }

  beforeEach(() => {
    originalLocalStorage = window.localStorage;
    window.localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    storageModule?.stopCrossTabTokenSync();
    storageModule = null;
    window.localStorage.clear();
  });

  it('reads through to a token another tab wrote without any event', async () => {
    const module_ = await loadStorageModule();
    // detached, so only the read-through can see the other tab's write
    module_.stopCrossTabTokenSync();

    window.localStorage.setItem(TOKEN_KEY, 'rotated-access');
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'rotated-refresh');

    expect(module_.getStoredToken()).toBe('rotated-access');
    expect(module_.getStoredRefreshToken()).toBe('rotated-refresh');
  });

  it('refreshes the cached pair when another tab reports a storage event', async () => {
    const module_ = await loadStorageModule();
    module_.setStoredToken('boot-access', 'boot-refresh');

    writeInAnotherTab(TOKEN_KEY, 'rotated-access');
    writeInAnotherTab(REFRESH_TOKEN_KEY, 'rotated-refresh');
    // reads now fail, so only a cache the listener refreshed can answer
    breakStorageReads();

    expect(module_.getStoredToken()).toBe('rotated-access');
    expect(module_.getStoredRefreshToken()).toBe('rotated-refresh');
  });

  it('falls back to the in-memory pair when storage reads throw', async () => {
    const module_ = await loadStorageModule();
    module_.setStoredToken('memory-access', 'memory-refresh');

    breakStorageReads();

    expect(module_.getStoredToken()).toBe('memory-access');
    expect(module_.getStoredRefreshToken()).toBe('memory-refresh');
  });

  it('keeps the in-memory pair when another tab removes the tokens', async () => {
    const module_ = await loadStorageModule();
    module_.setStoredToken('live-access', 'live-refresh');

    writeInAnotherTab(TOKEN_KEY, null);
    writeInAnotherTab(REFRESH_TOKEN_KEY, null);

    // a removal elsewhere is not proof this session ended
    expect(module_.getStoredToken()).toBe('live-access');
    expect(module_.getStoredRefreshToken()).toBe('live-refresh');
  });

  it('keeps the in-memory pair when another tab clears all storage', async () => {
    const module_ = await loadStorageModule();
    module_.setStoredToken('live-access', 'live-refresh');

    window.localStorage.clear();
    window.dispatchEvent(
      new StorageEvent('storage', { key: null, newValue: null }),
    );

    expect(module_.getStoredToken()).toBe('live-access');
    expect(module_.getStoredRefreshToken()).toBe('live-refresh');
  });

  it('registers exactly one storage listener when the module loads', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    await loadStorageModule();

    const storageRegistrations = addEventListenerSpy.mock.calls.filter(
      ([type]) => type === 'storage',
    );
    expect(storageRegistrations).toHaveLength(1);
    addEventListenerSpy.mockRestore();
  });

  it('stops refreshing the cache once the sync is torn down', async () => {
    const module_ = await loadStorageModule();
    module_.setStoredToken('boot-access', 'boot-refresh');

    module_.stopCrossTabTokenSync();
    writeInAnotherTab(TOKEN_KEY, 'rotated-access');
    breakStorageReads();

    expect(module_.getStoredToken()).toBe('boot-access');
  });
});
