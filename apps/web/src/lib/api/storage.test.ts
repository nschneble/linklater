import { afterEach, describe, expect, it, vi } from 'vitest';

const TOKEN_KEY = 'linklater_token';
const REFRESH_TOKEN_KEY = 'linklater_refresh_token';

/**
 * Read precedence between the persisted pair and the in-memory one, plus
 * the module's survival under a hostile store. `test/setup.ts` installs a
 * hand-rolled `localStorage` that never throws and fires no events, so
 * spies stand in for the states a real browser reaches on its own: reads
 * that throw (Safari private browsing, storage-blocked sites) and writes
 * that throw while reads keep serving the older value (quota exhaustion,
 * some Safari private-browsing and ITP states).
 *
 * `safeStorage.ts` holds that layer and has no suite of its own: nothing it
 * exports is reachable outside these accessors, so what is worth pinning is
 * the answer a token read gives, which is what every case below asks for.
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

    const module = await loadStorageModule();

    expect(module.getStoredToken()).toBeNull();
    expect(module.getStoredRefreshToken()).toBeNull();
  });

  it('prefers the persisted pair once its own write has landed', async () => {
    const module = await loadStorageModule();
    module.setStoredToken('local-access', 'local-refresh');
    // detached, so only the read-through can see the other tab's write
    module.stopCrossTabTokenSync();

    window.localStorage.setItem(TOKEN_KEY, 'rotated-access');
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'rotated-refresh');

    expect(module.getStoredToken()).toBe('rotated-access');
    expect(module.getStoredRefreshToken()).toBe('rotated-refresh');
  });

  it('keeps the fresh pair when the store refuses the write', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stale-access');
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'stale-refresh');
    const module = await loadStorageModule();
    refuseWrites();

    expect(() =>
      module.setStoredToken('fresh-access', 'fresh-refresh'),
    ).not.toThrow();
    expect(module.getStoredToken()).toBe('fresh-access');
    expect(module.getStoredRefreshToken()).toBe('fresh-refresh');
  });

  it('prefers a sibling rotation that lands after a refused write', async () => {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'older-refresh');
    const module = await loadStorageModule();
    // detached, so the store having moved is the only available evidence
    module.stopCrossTabTokenSync();
    refuseWrites();
    module.setStoredToken('my-access', 'my-refresh');

    vi.restoreAllMocks();
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'sibling-refresh');

    expect(module.getStoredRefreshToken()).toBe('sibling-refresh');
  });

  it('reads null after a clear the store refused', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stale-access');
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'stale-refresh');
    const module = await loadStorageModule();
    refuseWrites();

    expect(() => module.clearStoredToken()).not.toThrow();
    expect(module.getStoredToken()).toBeNull();
    expect(module.getStoredRefreshToken()).toBeNull();
  });

  it('prefers the persisted value again once a later write lands', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stale-access');
    const module = await loadStorageModule();
    module.stopCrossTabTokenSync();
    refuseWrites();
    module.setStoredToken('unpersisted-access');

    // the store starts taking writes again
    vi.restoreAllMocks();
    module.setStoredToken('second-access');
    window.localStorage.setItem(TOKEN_KEY, 'rotated-access');

    expect(module.getStoredToken()).toBe('rotated-access');
  });

  it('falls back to the in-memory pair when reads throw', async () => {
    const module = await loadStorageModule();
    module.setStoredToken('memory-access', 'memory-refresh');

    breakStorageReads();

    expect(module.getStoredToken()).toBe('memory-access');
    expect(module.getStoredRefreshToken()).toBe('memory-refresh');
  });

  it('drops a nomination the arriving pair makes moot', async () => {
    const module = await loadStorageModule();
    const nominated = module.nominateRefreshToken();

    module.setStoredToken('signed-in-access', 'signed-in-refresh');

    // otherwise a sign-in leaves a live token for the account before it
    expect(nominated).toMatch(/^[0-9a-f]{64}$/);
    expect(module.getNominatedRefreshToken()).toBeNull();
  });

  it('drops the nomination when the pair is cleared', async () => {
    const module = await loadStorageModule();
    module.nominateRefreshToken();

    module.clearStoredToken();

    expect(module.getNominatedRefreshToken()).toBeNull();
  });

  it('persists the refresh token before the access token', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    const module = await loadStorageModule();

    module.setStoredToken('access-token', 'refresh-token');

    expect(setItemSpy.mock.calls.map(([key]) => key)).toEqual([
      REFRESH_TOKEN_KEY,
      TOKEN_KEY,
    ]);
  });
});
