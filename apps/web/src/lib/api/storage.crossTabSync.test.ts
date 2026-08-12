import { afterEach, describe, expect, it, vi } from 'vitest';

const TOKEN_KEY = 'linklater_token';
const REFRESH_TOKEN_KEY = 'linklater_refresh_token';

/**
 * Verifies that a token pair rotated in one tab reaches every other tab of
 * the same origin. `test/setup.ts` replaces `window.localStorage` with a
 * hand-rolled store that fires no events, so the other tab is simulated
 * here by writing to that store and dispatching a `StorageEvent` by hand.
 *
 * The browser delivers that event as a queued task, which is why the write
 * and the dispatch are separable below: a sibling's write can be delivered
 * after work this tab did in the gap.
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
    deliverStorageEvent(key, value);
  }

  function deliverStorageEvent(key: string, value: string | null): void {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
  }

  function refuseWrites(): void {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
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

  it('keeps the token this tab holds when a sibling event arrives late', async () => {
    const module = await loadStorageModule();
    // the sibling's write lands first; its event is still queued
    window.localStorage.setItem(TOKEN_KEY, 'sibling-access');
    refuseWrites();
    module.setStoredToken('my-access');

    vi.restoreAllMocks();
    deliverStorageEvent(TOKEN_KEY, 'sibling-access');

    expect(module.getStoredToken()).toBe('my-access');
  });

  it('reads no supersession from a sibling event that arrives late', async () => {
    const module = await loadStorageModule();
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'sibling-refresh');
    refuseWrites();
    module.setStoredToken('my-access', 'my-refresh');

    vi.restoreAllMocks();
    deliverStorageEvent(REFRESH_TOKEN_KEY, 'sibling-refresh');

    // this tab never rotated to the sibling's token, so nothing superseded
    expect(module.isRefreshTokenSuperseded('my-refresh')).toBe(false);
  });

  it('leaves a refused logout cleared when a late event carries the same value', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'live-access');
    const module = await loadStorageModule();
    refuseWrites();
    module.clearStoredToken();

    vi.restoreAllMocks();
    deliverStorageEvent(TOKEN_KEY, 'live-access');

    expect(module.getStoredToken()).toBeNull();
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

  // exported so callers can tell a sign-in from a theme write
  describe('isTokenStorageEvent', () => {
    function ask(key: string | null): Promise<boolean> {
      return loadStorageModule().then((module) =>
        module.isTokenStorageEvent(new StorageEvent('storage', { key })),
      );
    }

    it('accepts the access token key', async () => {
      expect(await ask(TOKEN_KEY)).toBe(true);
    });

    it('accepts the refresh token key', async () => {
      expect(await ask(REFRESH_TOKEN_KEY)).toBe(true);
    });

    it('accepts a whole-store clear, which takes the pair with it', async () => {
      expect(await ask(null)).toBe(true);
    });

    it('rejects a theme write, which a sibling makes on every toggle', async () => {
      expect(await ask('linklater_theme')).toBe(false);
    });

    it('rejects a key that merely starts the same', async () => {
      expect(await ask('linklater_token_updated_at')).toBe(false);
    });
  });
});
