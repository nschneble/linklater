import { afterEach, describe, expect, it, vi } from 'vitest';

const TOKEN_KEY = 'linklater_token';
const REFRESH_TOKEN_KEY = 'linklater_refresh_token';

/**
 * Read precedence between the persisted pair and the in-memory one, plus the
 * module's survival under a hostile store. The store here is the real jsdom
 * `localStorage`; spies stand in for the states a browser reaches on its
 * own – reads that throw (Safari private browsing, storage-blocked sites)
 * and writes that throw while reads keep serving the older value (quota
 * exhaustion, some Safari private-browsing and ITP states).
 *
 * The module is re-imported per test so its top-level read and its cache
 * start clean; the listener each import registers is torn down in
 * `afterEach`.
 */
describe('storage.ts token precedence', () => {
  let storageModule: typeof import('./storage') | null = null;

  async function loadStorageModule(): Promise<typeof import('./storage')> {
    vi.resetModules();
    storageModule = await import('./storage');
    return storageModule;
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

  it('survives module load when reads throw', async () => {
    breakStorageReads();

    const module_ = await loadStorageModule();

    expect(module_.getStoredToken()).toBeNull();
    expect(module_.getStoredRefreshToken()).toBeNull();
  });

  it('prefers the persisted pair once its own write has landed', async () => {
    const module_ = await loadStorageModule();
    module_.setStoredToken('local-access', 'local-refresh');
    // detached, so only the read-through can see the other tab's write
    module_.stopCrossTabTokenSync();

    window.localStorage.setItem(TOKEN_KEY, 'rotated-access');
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'rotated-refresh');

    expect(module_.getStoredToken()).toBe('rotated-access');
    expect(module_.getStoredRefreshToken()).toBe('rotated-refresh');
  });

  it('keeps the fresh pair when the store refuses the write', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stale-access');
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'stale-refresh');
    const module_ = await loadStorageModule();
    refuseWrites();

    expect(() =>
      module_.setStoredToken('fresh-access', 'fresh-refresh'),
    ).not.toThrow();
    expect(module_.getStoredToken()).toBe('fresh-access');
    expect(module_.getStoredRefreshToken()).toBe('fresh-refresh');
  });

  it('reads null after a clear the store refused', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stale-access');
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'stale-refresh');
    const module_ = await loadStorageModule();
    refuseWrites();

    expect(() => module_.clearStoredToken()).not.toThrow();
    expect(module_.getStoredToken()).toBeNull();
    expect(module_.getStoredRefreshToken()).toBeNull();
  });

  it('prefers the persisted value again once a later write lands', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stale-access');
    const module_ = await loadStorageModule();
    module_.stopCrossTabTokenSync();
    refuseWrites();
    module_.setStoredToken('unpersisted-access');

    // the store starts taking writes again
    vi.restoreAllMocks();
    module_.setStoredToken('second-access');
    window.localStorage.setItem(TOKEN_KEY, 'rotated-access');

    expect(module_.getStoredToken()).toBe('rotated-access');
  });

  it('falls back to the in-memory pair when reads throw', async () => {
    const module_ = await loadStorageModule();
    module_.setStoredToken('memory-access', 'memory-refresh');

    breakStorageReads();

    expect(module_.getStoredToken()).toBe('memory-access');
    expect(module_.getStoredRefreshToken()).toBe('memory-refresh');
  });

  it('persists the refresh token before the access token', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    const module_ = await loadStorageModule();

    module_.setStoredToken('access-token', 'refresh-token');

    expect(setItemSpy.mock.calls.map(([key]) => key)).toEqual([
      REFRESH_TOKEN_KEY,
      TOKEN_KEY,
    ]);
  });
});
