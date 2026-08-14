import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attemptSpeculativeRefresh, attemptTokenRefresh } from './tokenRefresh';
import {
  clearStoredToken,
  getNominatedRefreshToken,
  getStoredRefreshToken,
  getStoredToken,
  setStoredToken,
} from './storage';

const NOMINATION_KEY = 'linklater_nominated_refresh_token';

/**
 * `attemptTokenRefresh` on its own: what it answers, and what it leaves in
 * the token store. The boolean is the whole contract with `apiFetch`, which
 * reads it as permission to retry; whether that retry then succeeds is the
 * caller's business and lives in `index.test.ts`.
 *
 * Only `fetch` is replaced. The real store runs, because the verdicts here
 * are about the pair it holds afterwards.
 *
 * The concurrent rows are load-bearing. One refusal reaches two callers
 * holding opposite policies on it, so the pair they leave behind has to be
 * the same whichever of them opened the leg, and the calls are made in one
 * tick because that is what makes the second join the first rather than
 * start its own.
 *
 * A refused caller now spends two legs, the second carrying the successor
 * this client nominated, so leg counts through here read one higher than
 * they did before that existed.
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

  function bodyOf(
    mock: ReturnType<typeof vi.fn>,
    index: number,
  ): Record<string, string> {
    const [, options] = mock.mock.calls[index] as [string, RequestInit];
    return JSON.parse(options.body as string) as Record<string, string>;
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

  it('sends the stored refresh token and a nominated successor', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    const fetchMock = vi.fn().mockResolvedValue(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await attemptTokenRefresh();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/refresh');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({
      refreshToken: 'valid-refresh',
      nextRefreshToken: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('stores the nomination before the request that spends it goes out', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    const order: string[] = [];
    const store = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => {
        order.push(key);
        store(key, value);
      },
    );
    globalThis.fetch = vi.fn(() => {
      order.push('fetch');
      return Promise.resolve(rotatedPair());
    }) as unknown as typeof fetch;

    await attemptTokenRefresh();

    // a nomination written after the answer would not survive losing it
    expect(order.indexOf(NOMINATION_KEY)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf(NOMINATION_KEY)).toBeLessThan(order.indexOf('fetch'));
  });

  it('keeps one nomination across legs so a committed successor survives', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respondWith(500, { message: 'Server error' }))
      .mockResolvedValueOnce(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await attemptTokenRefresh();
    await attemptTokenRefresh();

    // a fresh one here would overwrite the successor the server just kept
    expect(bodyOf(fetchMock, 0).nextRefreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(bodyOf(fetchMock, 1).nextRefreshToken).toBe(
      bodyOf(fetchMock, 0).nextRefreshToken,
    );
  });

  it('replays with the nominated successor when the spent token is refused', async () => {
    setStoredToken('expired-jwt', 'spent-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respondWith(401, { message: 'Invalid refresh' }))
      .mockResolvedValueOnce(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(true);

    // the replay is the recovery leg, so it nominates nothing of its own
    expect(bodyOf(fetchMock, 1)).toEqual({
      refreshToken: bodyOf(fetchMock, 0).nextRefreshToken,
    });
    expect(getStoredToken()).toBe('new-jwt');
    expect(getStoredRefreshToken()).toBe('new-refresh');
  });

  it('keeps a sibling rotation that lands while the replay runs', async () => {
    setStoredToken('expired-jwt', 'spent-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respondWith(401, { message: 'Invalid refresh' }))
      .mockImplementationOnce(() => {
        // the sibling wins the one nomination both tabs share
        localStorage.setItem('linklater_token', 'sibling-jwt');
        localStorage.setItem('linklater_refresh_token', 'sibling-refresh');
        return Promise.resolve(
          respondWith(401, { message: 'Invalid refresh' }),
        );
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(true);

    // clearing here would throw away the live pair the sibling just stored
    expect(getStoredToken()).toBe('sibling-jwt');
    expect(getStoredRefreshToken()).toBe('sibling-refresh');
  });

  it('drops the nomination once the pair has rotated', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(rotatedPair()) as unknown as typeof fetch;

    await attemptTokenRefresh();

    expect(getNominatedRefreshToken()).toBeNull();
  });

  it('keeps the pair and the nomination when the replay is throttled', async () => {
    setStoredToken('expired-jwt', 'spent-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respondWith(401, { message: 'Invalid refresh' }))
      .mockResolvedValueOnce(
        respondWith(429, { message: 'Too many refresh attempts' }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(false);

    // throttled is not refused, so nothing here has been proven spent
    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('spent-refresh');
    expect(getNominatedRefreshToken()).toBe(
      bodyOf(fetchMock, 0).nextRefreshToken,
    );
  });

  it('shares one replay between concurrent refused callers', async () => {
    setStoredToken('expired-jwt', 'spent-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respondWith(401, { message: 'Invalid refresh' }))
      .mockResolvedValue(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const [first, second] = await Promise.all([
      attemptTokenRefresh(),
      attemptTokenRefresh(),
    ]);

    // two replays would leave the loser reading its own 401 as a dead session
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toBe(true);
    expect(second).toBe(true);
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

    expect(bodyOf(fetchMock, 1).refreshToken).toBe('valid-refresh');
    expect(getStoredToken()).toBe('new-jwt');
  });

  it('keeps the pair when a 200 carries nothing readable', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html>captive portal</html>'),
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    }) as unknown as typeof fetch;

    // a body that will not parse proves no more than a dead socket does
    await expect(attemptTokenRefresh()).resolves.toBe(false);

    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('valid-refresh');
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

  it('clears for a refused caller whose leg a speculative one started', async () => {
    setStoredToken('expired-jwt', 'spent-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respondWith(401, { message: 'Invalid refresh' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const speculative = attemptSpeculativeRefresh();
    const refused = attemptTokenRefresh();
    await Promise.all([speculative, refused]);

    // one shared refusal, then the replay only the refused caller takes
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('keeps nothing alive for a speculative caller joining a refused leg', async () => {
    setStoredToken('expired-jwt', 'spent-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respondWith(401, { message: 'Invalid refresh' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const refused = attemptTokenRefresh();
    const speculative = attemptSpeculativeRefresh();
    await Promise.all([refused, speculative]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('leaves the pair alone when only speculative callers are refused', async () => {
    setStoredToken('expired-jwt', 'spent-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respondWith(401, { message: 'Invalid refresh' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await Promise.all([
      attemptSpeculativeRefresh(),
      attemptSpeculativeRefresh(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('spent-refresh');
  });

  it('starts a new leg once a failed one settles', async () => {
    setStoredToken('expired-jwt', 'expired-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respondWith(401, { message: 'Invalid refresh' }))
      .mockResolvedValueOnce(respondWith(401, { message: 'Invalid refresh' }))
      .mockResolvedValueOnce(rotatedPair());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(attemptTokenRefresh()).resolves.toBe(false);
    setStoredToken('another-expired-jwt', 'another-valid-refresh');

    // a failure releases both slots; it does not block later attempts
    await expect(attemptTokenRefresh()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
