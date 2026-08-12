import { afterEach, describe, expect, it, vi } from 'vitest';

const TOKEN_KEY = 'linklater_token';
const REFRESH_TOKEN_KEY = 'linklater_refresh_token';

/**
 * Verifies that a token pair rotated in one tab reaches every other tab of
 * the same origin. The `storage` event never fires in the tab that wrote, so
 * the other tab is simulated here by writing to the real
 * `window.localStorage` and dispatching a `StorageEvent` by hand.
 *
 * The module is re-imported per test so its cache starts clean; the listener
 * each import registers is torn down in `afterEach`.
 */
describe('storage.ts cross-tab token sync', () => {
  let storageModule: typeof import('./storage') | null = null;

  async function loadStorageModule(): Promise<typeof import('./storage')> {
    vi.resetModules();
    storageModule = await import('./storage');
    return storageModule;
  }

  function writeInAnotherTab(key: string, value: string | null): void {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
  }

  function breakStorageReads(): void {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError: localStorage is blocked');
    });
  }

  afterEach(() => {
    storageModule?.stopCrossTabTokenSync();
    storageModule = null;
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('refreshes the cached pair when another tab reports a storage event', async () => {
    const module = await loadStorageModule();
    module.setStoredToken('boot-access', 'boot-refresh');

    writeInAnotherTab(TOKEN_KEY, 'rotated-access');
    writeInAnotherTab(REFRESH_TOKEN_KEY, 'rotated-refresh');
    // reads now fail, so only a cache the listener refreshed can answer
    breakStorageReads();

    expect(module.getStoredToken()).toBe('rotated-access');
    expect(module.getStoredRefreshToken()).toBe('rotated-refresh');
  });

  it('lets another tab supersede a write this tab could not persist', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stale-access');
    const module = await loadStorageModule();
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    module.setStoredToken('unpersisted-access');

    // the other tab's write does land, and is newer than this tab's
    vi.restoreAllMocks();
    writeInAnotherTab(TOKEN_KEY, 'sibling-access');

    expect(module.getStoredToken()).toBe('sibling-access');
  });

  it('keeps the in-memory pair when another tab removes the tokens', async () => {
    const module = await loadStorageModule();
    module.setStoredToken('live-access', 'live-refresh');

    writeInAnotherTab(TOKEN_KEY, null);
    writeInAnotherTab(REFRESH_TOKEN_KEY, null);

    // a removal elsewhere is not proof this session ended
    expect(module.getStoredToken()).toBe('live-access');
    expect(module.getStoredRefreshToken()).toBe('live-refresh');
  });

  it('keeps the in-memory pair when another tab clears all storage', async () => {
    const module = await loadStorageModule();
    module.setStoredToken('live-access', 'live-refresh');

    window.localStorage.clear();
    window.dispatchEvent(
      new StorageEvent('storage', { key: null, newValue: null }),
    );

    expect(module.getStoredToken()).toBe('live-access');
    expect(module.getStoredRefreshToken()).toBe('live-refresh');
  });

  it('ignores a storage event for an unrelated key', async () => {
    await loadStorageModule();
    const getItemSpy = vi.spyOn(window.localStorage, 'getItem');

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'theme', newValue: 'apollo' }),
    );

    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it('registers exactly one storage listener when the module loads', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    await loadStorageModule();

    const storageRegistrations = addEventListenerSpy.mock.calls.filter(
      ([type]) => type === 'storage',
    );
    expect(storageRegistrations).toHaveLength(1);
  });

  it('stops refreshing the cache once the sync is torn down', async () => {
    const module = await loadStorageModule();
    module.setStoredToken('boot-access', 'boot-refresh');

    module.stopCrossTabTokenSync();
    writeInAnotherTab(TOKEN_KEY, 'rotated-access');
    breakStorageReads();

    expect(module.getStoredToken()).toBe('boot-access');
  });
});
