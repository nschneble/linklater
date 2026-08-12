import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attemptTokenRefresh } from './tokenRefresh';
import {
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  setStoredToken,
} from './storage';

/**
 * `attemptTokenRefresh` on its own: what it answers, and what it leaves in
 * the token store. The boolean is the whole contract with `apiFetch`, which
 * reads it as permission to retry; whether that retry then succeeds is the
 * caller's business and lives in `index.test.ts`.
 *
 * Only `fetch` is replaced. The real store runs, because the verdicts here
 * are about the pair it holds afterwards.
 */
describe('tokenRefresh.ts', () => {
  function respondWith(status: number, body: unknown): unknown {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      json: () => Promise.resolve(body),
    };
  }

  function rotatedPair(): unknown {
    return respondWith(200, {
      accessToken: 'new-jwt',
      refreshToken: 'new-refresh',
    });
  }

  beforeEach(() => {
    localStorage.clear();
    clearStoredToken();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('stores the rotated pair and reports success', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    const fetchMock = vi.fn().mockResolvedValue(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(true);

    expect(getStoredToken()).toBe('new-jwt');
    expect(getStoredRefreshToken()).toBe('new-refresh');
  });

  it('sends the stored refresh token to the refresh endpoint', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    const fetchMock = vi.fn().mockResolvedValue(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await attemptTokenRefresh();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/refresh');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({
      refreshToken: 'valid-refresh',
    });
  });

  it('clears the dead access token when no refresh token is stored', async () => {
    setStoredToken('dead-jwt');
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(false);

    // nothing to renew with, so the rejected token is dead for good
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getStoredToken()).toBeNull();
  });

  it('clears the pair when the server rejects the refresh token', async () => {
    setStoredToken('expired-jwt', 'expired-refresh');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        respondWith(401, { message: 'Invalid refresh token' }),
      ) as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(false);

    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('clears the pair when the refresh endpoint answers 403', async () => {
    setStoredToken('expired-jwt', 'forbidden-refresh');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        respondWith(403, { message: 'Forbidden' }),
      ) as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(false);

    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('reports success without a second leg when a sibling rotated first', async () => {
    setStoredToken('expired-jwt', 'my-refresh');
    const fetchMock = vi.fn(() => {
      // the sibling's pair lands while this refresh is in flight
      localStorage.setItem('linklater_token', 'sibling-jwt');
      localStorage.setItem('linklater_refresh_token', 'sibling-refresh');
      return Promise.resolve(respondWith(401, { message: 'Invalid refresh' }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(true);

    // a 401 on a token the sibling replaced proves it spent, not dead
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getStoredRefreshToken()).toBe('sibling-refresh');
  });

  it('keeps the pair when the refresh endpoint answers 500', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        respondWith(500, { message: 'Server error' }),
      ) as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(false);

    // a server fault is not a spent session
    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('valid-refresh');
  });

  it('spends the surviving token on the attempt after a transient failure', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respondWith(500, { message: 'Server error' }))
      .mockResolvedValueOnce(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(false);
    await expect(attemptTokenRefresh()).resolves.toBe(true);

    const [, secondOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(secondOptions.body as string)).toEqual({
      refreshToken: 'valid-refresh',
    });
    expect(getStoredToken()).toBe('new-jwt');
  });

  it('keeps the pair when the refresh fetch rejects with a network error', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        new TypeError('Failed to fetch'),
      ) as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(false);

    // a refresh that reached no server reached no verdict either
    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('valid-refresh');
  });

  it('keeps the pair when a hung refresh aborts at its deadline', async () => {
    vi.useFakeTimers();
    setStoredToken('expired-jwt', 'valid-refresh');
    globalThis.fetch = vi.fn((_input: unknown, options?: RequestInit) => {
      // a socket that never answers; settles only when the deadline aborts
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted', 'AbortError')),
        );
      });
    }) as unknown as typeof fetch;

    const pending = attemptTokenRefresh();
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBe(false);
    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('valid-refresh');
  });

  it('lets a refresh answering inside the deadline complete', async () => {
    vi.useFakeTimers();
    setStoredToken('expired-jwt', 'valid-refresh');
    globalThis.fetch = vi.fn((_input: unknown, options?: RequestInit) => {
      return new Promise((resolve, reject) => {
        options?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted', 'AbortError')),
        );
        setTimeout(() => resolve(rotatedPair()), 9_000);
      });
    }) as unknown as typeof fetch;

    const pending = attemptTokenRefresh();
    await vi.advanceTimersByTimeAsync(9_000);

    await expect(pending).resolves.toBe(true);
    expect(getStoredToken()).toBe('new-jwt');
  });

  it('does not wire the deadline to any caller signal', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    const callerController = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await attemptTokenRefresh();
    callerController.abort();

    // one caller walking away must not kill the refresh every 401 awaits
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal?.aborted).toBe(false);
  });

  it('shares one network leg between concurrent callers', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    let releaseRefresh: (value: unknown) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseRefresh = resolve;
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = attemptTokenRefresh();
    const second = attemptTokenRefresh();
    releaseRefresh(rotatedPair());

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('starts a new leg once a failed one settles', async () => {
    setStoredToken('expired-jwt', 'expired-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respondWith(401, { message: 'Invalid refresh' }))
      .mockResolvedValueOnce(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(false);
    setStoredToken('another-expired-jwt', 'another-valid-refresh');

    // a failure releases the slot; it does not block later attempts
    await expect(attemptTokenRefresh()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
