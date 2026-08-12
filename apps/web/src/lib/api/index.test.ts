/**
 * Tests for the central API client (`lib/api/`).
 *
 * All network calls are intercepted by replacing `globalThis.fetch` with a
 * vi.fn(). Tests verify both the happy path (correct URL, method, headers,
 * returned value) and the error path (non-2xx responses, JSON vs. plain-text
 * error bodies).
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import {
  ApiError,
  apiFetch,
  clearStoredToken,
  createApiToken,
  createLink,
  deleteAllReadLinks,
  deleteLink,
  deleteMe,
  disableMfa,
  forgotPassword,
  getLink,
  getLinks,
  getMe,
  getRandomLink,
  getStoredRefreshToken,
  getStoredToken,
  initiateOAuthLink,
  listApiTokens,
  login,
  logout,
  readLink,
  regenerateRecoveryCodes,
  register,
  registerMagicLink,
  requestEmailChange,
  requestMagicLink,
  resendEmailChangeVerification,
  resendVerificationEmail,
  resetPassword,
  revokeAllSessions,
  revokeApiToken,
  setPassword,
  setStoredToken,
  setupTotp,
  stumbleLink,
  unlinkOAuthProvider,
  unreadLink,
  updateMe,
  verifyEmail,
  verifyEmailChange,
  verifyMagicLink,
  verifyOtp,
  verifyTotpSetup,
} from '.';

function mockFetch(body: unknown, status = 200): Mock {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

function mockFetchText(text: string, status = 400): Mock {
  const mock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve({}),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

/**
 * Simulates a 2xx response with an empty body. Used to exercise the
 * `ApiError` guards in `auth.ts` that throw when typed endpoints receive
 * `undefined`.
 */
function mockFetchEmptyBody(status = 200): Mock {
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    status,
    text: () => Promise.resolve(''),
    json: () => Promise.resolve(undefined),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(() => {
  localStorage.clear();
  clearStoredToken();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('token helpers', () => {
  it('getStoredToken returns null when no token is set', () => {
    expect(getStoredToken()).toBeNull();
  });

  it('setStoredToken persists the access token in memory and localStorage', () => {
    setStoredToken('my-jwt');
    expect(getStoredToken()).toBe('my-jwt');
    expect(localStorage.getItem('linklater_token')).toBe('my-jwt');
  });

  it('setStoredToken also persists the refresh token when provided', () => {
    setStoredToken('my-jwt', 'my-refresh');
    expect(getStoredToken()).toBe('my-jwt');
    expect(getStoredRefreshToken()).toBe('my-refresh');
    expect(localStorage.getItem('linklater_refresh_token')).toBe('my-refresh');
  });

  it('setStoredToken leaves the refresh token unchanged when not provided', () => {
    setStoredToken('my-jwt', 'existing-refresh');
    setStoredToken('new-jwt');
    expect(getStoredRefreshToken()).toBe('existing-refresh');
  });

  it('clearStoredToken removes both tokens from memory and localStorage', () => {
    setStoredToken('my-jwt', 'my-refresh');
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
    expect(localStorage.getItem('linklater_token')).toBeNull();
    expect(localStorage.getItem('linklater_refresh_token')).toBeNull();
  });
});

describe('apiFetch', () => {
  it('attaches Content-Type application/json header', async () => {
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('attaches Authorization header when a token is stored', async () => {
    setStoredToken('test-token');
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token');
  });

  it('omits Authorization header when authContext is false', async () => {
    setStoredToken('test-token');
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test', {}, false);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('uses a custom string token when authContext is a string', async () => {
    setStoredToken('stored-token');
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test', {}, 'custom-mfa-token');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer custom-mfa-token');
  });

  it('omits Authorization header when no token is stored', async () => {
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('throws ApiError with server JSON error message on non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ message: 'Invalid input' })),
    }) as unknown as typeof fetch;

    const error = await apiFetch('/test').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Invalid input');
    expect((error as ApiError).status).toBe(400);
  });

  it('throws ApiError with raw text when response body is not JSON', async () => {
    mockFetchText('Bad gateway', 502);

    const error = await apiFetch('/test').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Bad gateway');
    expect((error as ApiError).status).toBe(502);
  });

  it('throws ApiError with fallback message when response body is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;

    const error = await apiFetch('/test').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Request failed with 503');
    expect((error as ApiError).status).toBe(503);
  });

  it('returns parsed JSON on a 2xx response', async () => {
    mockFetch({ id: 'abc', url: 'https://example.com' });

    const result = await apiFetch<{ id: string; url: string }>('/test');

    expect(result).toEqual({ id: 'abc', url: 'https://example.com' });
  });

  it('returns undefined when the 2xx response body is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;

    const result = await apiFetch('/test');

    expect(result).toBeUndefined();
  });

  it('retries with new token after 401 when a refresh token is stored', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        // first attempt → 401
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        // token refresh → 200
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              accessToken: 'new-jwt',
              refreshToken: 'new-refresh',
            }),
          ),
        json: () =>
          Promise.resolve({
            accessToken: 'new-jwt',
            refreshToken: 'new-refresh',
          }),
      })
      .mockResolvedValueOnce({
        // retry → 200
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'result' })),
      }) as unknown as typeof fetch;

    const result = await apiFetch<{ id: string }>('/test');

    expect(result).toEqual({ id: 'result' });
    expect(getStoredToken()).toBe('new-jwt');
    expect(getStoredRefreshToken()).toBe('new-refresh');
  });

  it('clears tokens and throws when refresh token is expired', async () => {
    setStoredToken('expired-jwt', 'expired-refresh');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Invalid refresh token' })),
      }) as unknown as typeof fetch;

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('clears tokens and throws when the refresh endpoint answers 403', async () => {
    setStoredToken('expired-jwt', 'forbidden-refresh');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({ message: 'Forbidden' })),
      }) as unknown as typeof fetch;

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
    // 403 means the refresh token is rejected: session dead, clear the tokens
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('keeps the stored tokens when the refresh endpoint answers 500', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Server error' })),
      }) as unknown as typeof fetch;

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
    // 5xx is a server fault, not a spent session, so tokens survive to retry
    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('valid-refresh');
  });

  it('recovers on a later request after a transient refresh failure leaves the tokens intact', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        // first request → 401
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        // refresh → 500 (transient); the tokens must survive untouched
        ok: false,
        status: 500,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Server error' })),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch('/first')).rejects.toBeInstanceOf(ApiError);
    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('valid-refresh');

    (fetchMock as unknown as Mock)
      .mockResolvedValueOnce({
        // second request → 401
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        // refresh → 200; the surviving refresh token now rotates cleanly
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              accessToken: 'fresh-jwt',
              refreshToken: 'fresh-refresh',
            }),
          ),
        json: () =>
          Promise.resolve({
            accessToken: 'fresh-jwt',
            refreshToken: 'fresh-refresh',
          }),
      })
      .mockResolvedValueOnce({
        // retry → 200
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'recovered' })),
      });

    await expect(apiFetch<{ id: string }>('/second')).resolves.toEqual({
      id: 'recovered',
    });
    expect(getStoredToken()).toBe('fresh-jwt');
    expect(getStoredRefreshToken()).toBe('fresh-refresh');
  });

  it('refreshes with the token another tab rotated, not the stale cached one', async () => {
    setStoredToken('expired-jwt', 'spent-refresh');
    // the other tab rotated and persisted a successor before this 401
    localStorage.setItem('linklater_refresh_token', 'rotated-refresh');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              accessToken: 'fresh-jwt',
              refreshToken: 'fresh-refresh',
            }),
          ),
        json: () =>
          Promise.resolve({
            accessToken: 'fresh-jwt',
            refreshToken: 'fresh-refresh',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'retried' })),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch<{ id: string }>('/test')).resolves.toEqual({
      id: 'retried',
    });

    const [, refreshOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(refreshOptions.body as string)).toEqual({
      refreshToken: 'rotated-refresh',
    });
    expect(getStoredToken()).toBe('fresh-jwt');
  });

  it('does not retry when no refresh token is stored', async () => {
    setStoredToken('expired-jwt');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
    expect((fetchMock as unknown as Mock).mock.calls).toHaveLength(1);
  });

  it('clears the dead access token when a 401 finds no refresh token to renew it', async () => {
    // no refresh token, so a 401 proves the access token is dead: clear it
    setStoredToken('dead-jwt');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const error = await apiFetch('/test').catch((caught: unknown) => caught);
    // the original 401 still reaches the caller unchanged
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    // the dead access token is gone
    expect(getStoredToken()).toBeNull();
    // only the original request ran; no refresh leg fired
    expect((fetchMock as unknown as Mock).mock.calls).toHaveLength(1);
  });

  it('dedupes concurrent refreshes – two parallel 401s share one /auth/refresh call', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');

    let resolveRefresh: (value: unknown) => void = () => {};
    const refreshResponse = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    let retryTargetCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/auth/refresh')) {
        return refreshResponse;
      }

      if (url.includes('/retry-target')) {
        retryTargetCallCount += 1;
        if (retryTargetCallCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 401,
            text: () =>
              Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ id: 'retried' })),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = apiFetch('/retry-target');
    const second = apiFetch('/retry-target');

    await vi.waitFor(() => {
      const refreshCalls = fetchMock.mock.calls.filter(([input]) => {
        const url =
          typeof input === 'string' ? input : (input as URL).toString();
        return url.includes('/auth/refresh');
      });
      expect(refreshCalls).toHaveLength(1);
    });

    resolveRefresh({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            accessToken: 'new-jwt',
            refreshToken: 'new-refresh',
          }),
        ),
      json: () =>
        Promise.resolve({
          accessToken: 'new-jwt',
          refreshToken: 'new-refresh',
        }),
    });

    await expect(first).resolves.toEqual({ id: 'retried' });
    await expect(second).resolves.toEqual({ id: 'retried' });

    const totalRefreshCalls = fetchMock.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      return url.includes('/auth/refresh');
    });
    expect(totalRefreshCalls).toHaveLength(1);
  });

  it('allows a new refresh after the previous one settles (failure does not block future attempts)', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Invalid refresh token' })),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch('/first')).rejects.toBeInstanceOf(ApiError);
    expect(getStoredToken()).toBeNull();

    setStoredToken('another-expired-jwt', 'another-valid-refresh');

    (fetchMock as unknown as Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              accessToken: 'fresh-jwt',
              refreshToken: 'fresh-refresh',
            }),
          ),
        json: () =>
          Promise.resolve({
            accessToken: 'fresh-jwt',
            refreshToken: 'fresh-refresh',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'recovered' })),
      });

    await expect(apiFetch('/second')).resolves.toEqual({ id: 'recovered' });
    expect(getStoredToken()).toBe('fresh-jwt');
  });

  it('does not retry when authContext is false (suppresses the refresh-retry path)', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    await expect(apiFetch('/auth/refresh', {}, false)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect((fetchMock as unknown as Mock).mock.calls).toHaveLength(1);
  });
});

describe('apiFetch token-refresh deadline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the stored tokens when a hung refresh aborts at its deadline', async () => {
    vi.useFakeTimers();
    setStoredToken('expired-jwt', 'valid-refresh');

    globalThis.fetch = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/auth/refresh')) {
          // a socket that never answers; settles only when the deadline aborts it
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
          });
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          text: () =>
            Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
        });
      },
    ) as unknown as typeof fetch;

    // attach the reject handler before advancing so the abort isn't unhandled
    const caught = apiFetch('/test').catch((error: unknown) => error);
    // nothing resolves the refresh until REFRESH_DEADLINE_MS (10s) in core.ts
    await vi.advanceTimersByTimeAsync(10_000);

    const error = await caught;
    expect(error).toBeInstanceOf(ApiError);
    // the caller sees the original 401, not a refresh-specific error
    expect((error as ApiError).status).toBe(401);
    // a deadline abort is transient: no verdict reached, so tokens survive
    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('valid-refresh');
  });

  it('keeps the stored tokens when the refresh fetch rejects with a network error', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');

    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/refresh')) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      });
    }) as unknown as typeof fetch;

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
    // same as the deadline abort: a refresh not reaching server keeps tokens
    expect(getStoredToken()).toBe('expired-jwt');
    expect(getStoredRefreshToken()).toBe('valid-refresh');
  });

  it('lets a slow refresh that answers before the deadline complete the retry', async () => {
    vi.useFakeTimers();
    setStoredToken('expired-jwt', 'valid-refresh');

    let testCalls = 0;
    globalThis.fetch = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/auth/refresh')) {
          // answers at 9s, inside the 10s deadline: must complete, not abort
          return new Promise((resolve, reject) => {
            options?.signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  text: () =>
                    Promise.resolve(
                      JSON.stringify({
                        accessToken: 'new-jwt',
                        refreshToken: 'new-refresh',
                      }),
                    ),
                  json: () =>
                    Promise.resolve({
                      accessToken: 'new-jwt',
                      refreshToken: 'new-refresh',
                    }),
                }),
              9_000,
            );
          });
        }
        testCalls += 1;
        if (testCalls === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            text: () =>
              Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ id: 'result' })),
        });
      },
    ) as unknown as typeof fetch;

    const pending = apiFetch<{ id: string }>('/test');
    await vi.advanceTimersByTimeAsync(9_000);

    await expect(pending).resolves.toEqual({ id: 'result' });
    expect(getStoredToken()).toBe('new-jwt');
    expect(getStoredRefreshToken()).toBe('new-refresh');
  });
});

describe('register', () => {
  it('POSTs to /auth/register without an Authorization header', async () => {
    const fetchMock = mockFetch({ id: 'user-1', email: 'user@example.com' });

    await register('user@example.com', 'password123');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/register');
    expect((options as { method: string }).method).toBe('POST');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('login', () => {
  it('POSTs to /auth/login and stores the returned access and refresh tokens', async () => {
    mockFetch({ accessToken: 'fresh-jwt', refreshToken: 'fresh-refresh' });

    await login('user@example.com', 'password123');

    expect(getStoredToken()).toBe('fresh-jwt');
    expect(getStoredRefreshToken()).toBe('fresh-refresh');
  });

  it('returns the login response', async () => {
    mockFetch({ accessToken: 'fresh-jwt', refreshToken: 'fresh-refresh' });

    const result = await login('user@example.com', 'password123');

    expect(result).toEqual({
      accessToken: 'fresh-jwt',
      refreshToken: 'fresh-refresh',
    });
  });

  it('does not store a token when the server returns mfaToken', async () => {
    mockFetch({ mfaToken: 'mfa-tok', mfaMethod: 'totp' });

    await login('user@example.com', 'password123');

    expect(getStoredToken()).toBeNull();
  });

  it('returns mfaToken and mfaMethod when MFA is required', async () => {
    mockFetch({ mfaToken: 'mfa-tok', mfaMethod: 'email' });

    const result = await login('user@example.com', 'password123');

    expect(result).toEqual({ mfaToken: 'mfa-tok', mfaMethod: 'email' });
  });
});

describe('logout', () => {
  it('clears both stored tokens', async () => {
    mockFetch({ success: true });
    setStoredToken('some-jwt', 'some-refresh');

    await logout();

    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });
});

describe('revokeAllSessions', () => {
  it('DELETEs /auth/sessions with auth header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ success: true });

    await revokeAllSessions();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/sessions');
    expect((options as { method: string }).method).toBe('DELETE');
  });

  it('does not throw when the server returns an error', async () => {
    setStoredToken('my-jwt');
    mockFetchText('Unauthorized', 401);

    await expect(revokeAllSessions()).resolves.toBeUndefined();
  });
});

describe('getMe', () => {
  it('GETs /auth/me with auth header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({
      userId: 'u1',
      email: 'user@example.com',
      emailVerifiedAt: null,
      pendingEmail: null,
      mode: 'dark',
      theme: 'scanner-darkly',
    });

    await getMe();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/auth/me');
  });
});

describe('forgotPassword', () => {
  it('POSTs to /auth/forgot-password without auth', async () => {
    const fetchMock = mockFetch({});

    await forgotPassword('user@example.com');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/forgot-password');
    expect((options as { method: string }).method).toBe('POST');
  });
});

describe('verifyEmail', () => {
  it('POSTs to /auth/verify-email with the token', async () => {
    const fetchMock = mockFetch({});

    await verifyEmail('some-token');

    const [url] = fetchMock.mock.calls[0] as [string];
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/verify-email');
    expect((options as { body: string }).body).toContain('some-token');
  });
});

describe('resendVerificationEmail', () => {
  it('POSTs to /auth/resend-verification with auth', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await resendVerificationEmail();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/auth/resend-verification');
  });
});

describe('requestEmailChange', () => {
  it('POSTs to /auth/request-email-change with the new email', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await requestEmailChange('new@example.com');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/request-email-change');
    expect((options as { body: string }).body).toContain('new@example.com');
  });

  it('includes the code in the request body when provided', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await requestEmailChange('new@example.com', '123456');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse((options as { body: string }).body) as {
      email: string;
      code: string;
    };
    expect(body.code).toBe('123456');
  });

  it('omits the code field when not provided', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await requestEmailChange('new@example.com');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse((options as { body: string }).body) as Record<
      string,
      unknown
    >;
    expect(body['code']).toBeUndefined();
  });
});

describe('resendEmailChangeVerification', () => {
  it('POSTs to /auth/resend-email-change with auth', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await resendEmailChangeVerification();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/resend-email-change');
    expect(options.method).toBe('POST');
  });
});

describe('verifyEmailChange', () => {
  it('POSTs to /auth/verify-email-change without auth', async () => {
    const fetchMock = mockFetch({});

    await verifyEmailChange('change-token');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/verify-email-change');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('resetPassword', () => {
  it('POSTs to /auth/reset-password with token and password', async () => {
    const fetchMock = mockFetch({
      accessToken: 'fresh-jwt',
      refreshToken: 'fresh-refresh',
    });

    await resetPassword('reset-token', 'newpass123');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/reset-password');
    const body = JSON.parse((options as { body: string }).body) as {
      token: string;
      password: string;
    };
    expect(body.token).toBe('reset-token');
    expect(body.password).toBe('newpass123');
  });

  it('stores the returned access and refresh tokens on the non-MFA branch', async () => {
    mockFetch({ accessToken: 'reset-jwt', refreshToken: 'reset-refresh' });

    await resetPassword('reset-token', 'newpass123');

    expect(getStoredToken()).toBe('reset-jwt');
    expect(getStoredRefreshToken()).toBe('reset-refresh');
  });

  it('does not store a token when the server returns an MFA challenge', async () => {
    mockFetch({ mfaToken: 'mfa-tok', mfaMethod: 'totp' });

    const result = await resetPassword('reset-token', 'newpass123');

    expect(getStoredToken()).toBeNull();
    expect(result).toEqual({ mfaToken: 'mfa-tok', mfaMethod: 'totp' });
  });
});

describe('getLink', () => {
  it('GETs /links/:id', async () => {
    const fetchMock = mockFetch({ id: 'link-1', url: 'https://example.com' });

    await getLink('link-1');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/links/link-1');
  });
});

describe('getLinks', () => {
  it('GETs /links with no query params when options are omitted', async () => {
    const fetchMock = mockFetch({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    await getLinks();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/links$/);
  });

  it('appends read=true when read option is true', async () => {
    const fetchMock = mockFetch({ data: [], total: 0, page: 1, limit: 10 });

    await getLinks({ read: true });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('read=true');
  });

  it('appends read=false when read option is false', async () => {
    const fetchMock = mockFetch({ data: [], total: 0, page: 1, limit: 10 });

    await getLinks({ read: false });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('read=false');
  });

  it('appends search, page, and limit when provided', async () => {
    const fetchMock = mockFetch({ data: [], total: 0, page: 2, limit: 25 });

    await getLinks({ search: 'duck', page: 2, limit: 25 });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('search=duck');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=25');
  });
});

describe('createLink', () => {
  it('POSTs to /links with the url payload', async () => {
    const fetchMock = mockFetch(
      { id: 'link-1', url: 'https://example.com' },
      201,
    );

    await createLink({ url: 'https://example.com' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links');
    expect((options as { method: string }).method).toBe('POST');
    const body = JSON.parse((options as { body: string }).body) as {
      url: string;
    };
    expect(body.url).toBe('https://example.com');
  });
});

describe('readLink', () => {
  it('POSTs to /links/:id/read', async () => {
    const fetchMock = mockFetch({
      id: 'link-1',
      url: 'https://example.com',
      readAt: new Date().toISOString(),
    });

    await readLink('link-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/link-1/read');
    expect((options as { method: string }).method).toBe('POST');
  });
});

describe('unreadLink', () => {
  it('POSTs to /links/:id/unread', async () => {
    const fetchMock = mockFetch({
      id: 'link-1',
      url: 'https://example.com',
      readAt: null,
    });

    await unreadLink('link-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/link-1/unread');
    expect((options as { method: string }).method).toBe('POST');
  });
});

describe('deleteLink', () => {
  it('DELETEs /links/:id', async () => {
    const fetchMock = mockFetch({ success: true });

    await deleteLink('link-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/link-1');
    expect((options as { method: string }).method).toBe('DELETE');
  });
});

describe('deleteAllReadLinks', () => {
  it('DELETEs /links/read', async () => {
    const fetchMock = mockFetch({ count: 5 });

    await deleteAllReadLinks();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/read');
    expect((options as { method: string }).method).toBe('DELETE');
  });
});

describe('getRandomLink', () => {
  it('GETs /links/random', async () => {
    const fetchMock = mockFetch({ link: null });

    await getRandomLink();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/links\/random$/);
  });
});

describe('updateMe', () => {
  it('PATCHes /users/me with the provided fields', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ id: 'u1', email: 'user@example.com' });

    await updateMe({ theme: 'boyhood', mode: 'dark' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/users/me');
    expect((options as { method: string }).method).toBe('PATCH');
    const body = JSON.parse((options as { body: string }).body) as {
      theme: string;
      mode: string;
    };
    expect(body.theme).toBe('boyhood');
    expect(body.mode).toBe('dark');
  });
});

describe('deleteMe', () => {
  it('DELETEs /users/me', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ success: true });

    await deleteMe();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/users/me');
    expect((options as { method: string }).method).toBe('DELETE');
  });
});

describe('setupTotp', () => {
  it('POSTs to /auth/mfa/totp/setup with auth', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ qrCodeDataUrl: 'data:...', secret: 'ABC' });

    await setupTotp();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mfa/totp/setup');
    expect((options as { method: string }).method).toBe('POST');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBe('Bearer my-jwt');
  });
});

describe('verifyTotpSetup', () => {
  it('POSTs to /auth/mfa/totp/verify with the 6-digit code', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ recoveryCodes: ['aaaaa-bbbbb'] });

    await verifyTotpSetup('123456');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mfa/totp/verify');
    const body = JSON.parse((options as { body: string }).body) as {
      code: string;
    };
    expect(body.code).toBe('123456');
  });
});

describe('requestMagicLink', () => {
  it('POSTs to /auth/request-magic-link with email and no Authorization header', async () => {
    const fetchMock = mockFetch({});

    await requestMagicLink('user@example.com');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/request-magic-link');
    expect((options as { method: string }).method).toBe('POST');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
    const body = JSON.parse((options as { body: string }).body) as {
      email: string;
    };
    expect(body.email).toBe('user@example.com');
  });
});

describe('registerMagicLink', () => {
  it('POSTs to /auth/register-magic-link with email and no Authorization header', async () => {
    const fetchMock = mockFetch({});

    await registerMagicLink('user@example.com');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/register-magic-link');
    expect((options as { method: string }).method).toBe('POST');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
    const body = JSON.parse((options as { body: string }).body) as {
      email: string;
    };
    expect(body.email).toBe('user@example.com');
  });
});

describe('verifyMagicLink', () => {
  // verifyMagicLink returns tokens without storing; caller swaps sessions
  it('POSTs to /auth/verify-magic-link with token and returns the response without storing', async () => {
    const fetchMock = mockFetch({
      accessToken: 'ml-jwt',
      refreshToken: 'ml-refresh',
      userId: 'user-1',
    });

    const result = await verifyMagicLink('my-token');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/verify-magic-link');
    const body = JSON.parse((options as { body: string }).body) as {
      token: string;
    };
    expect(body.token).toBe('my-token');
    expect(result).toEqual({
      accessToken: 'ml-jwt',
      refreshToken: 'ml-refresh',
      userId: 'user-1',
    });
    expect(getStoredToken()).toBeNull();
  });

  // MFA accounts get a challenge back; return as-is so caller shows MfaView
  it('returns the mfa challenge unchanged and does not store any token', async () => {
    mockFetch({ mfaToken: 'pending-mfa-token', mfaMethod: 'totp' });

    const result = await verifyMagicLink('my-token');

    expect(result).toEqual({
      mfaToken: 'pending-mfa-token',
      mfaMethod: 'totp',
    });
    expect(getStoredToken()).toBeNull();
  });
});

describe('verifyOtp', () => {
  it('POSTs to /auth/verify-otp with mfaToken in body and no Authorization header', async () => {
    const fetchMock = mockFetch({ accessToken: 'full-jwt' });

    await verifyOtp('mfa-pending-token', '123456', 'totp');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/verify-otp');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
    const body = JSON.parse((options as { body: string }).body) as {
      mfaToken: string;
      code: string;
      method: string;
    };
    expect(body.mfaToken).toBe('mfa-pending-token');
    expect(body.code).toBe('123456');
    expect(body.method).toBe('totp');
  });

  it('stores the access token on success', async () => {
    mockFetch({ accessToken: 'full-jwt' });

    await verifyOtp('mfa-pending-token', '123456', 'totp');

    expect(getStoredToken()).toBe('full-jwt');
  });
});

describe('setPassword', () => {
  it('POSTs to /auth/set-password with password in body', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await setPassword('new-secure-password');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/set-password');
    expect((options as { method: string }).method).toBe('POST');
    const body = JSON.parse((options as { body: string }).body) as {
      password: string;
    };
    expect(body.password).toBe('new-secure-password');
  });
});

describe('unlinkOAuthProvider', () => {
  it('DELETEs /auth/providers/:provider with auth header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await unlinkOAuthProvider('google');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/providers/google');
    expect((options as { method: string }).method).toBe('DELETE');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBe('Bearer my-jwt');
  });

  it('encodes special characters in the provider name', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await unlinkOAuthProvider('some provider');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/auth/providers/some%20provider');
  });
});

describe('stumbleLink', () => {
  it('POSTs to /links/stumble with auth header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ url: 'https://example.com' });

    const result = await stumbleLink();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/stumble');
    expect((options as { method: string }).method).toBe('POST');
    expect(result).toEqual({ url: 'https://example.com' });
  });

  it('returns null url when no unread links exist', async () => {
    setStoredToken('my-jwt');
    mockFetch({ url: null });

    const result = await stumbleLink();

    expect(result).toEqual({ url: null });
  });
});

describe('disableMfa', () => {
  it('DELETEs /auth/mfa with the provided credentials', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await disableMfa({ currentPassword: 'open-sesame' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mfa');
    expect((options as { method: string }).method).toBe('DELETE');
    const body = JSON.parse((options as { body: string }).body) as {
      currentPassword: string;
    };
    expect(body.currentPassword).toBe('open-sesame');
  });
});

describe('regenerateRecoveryCodes', () => {
  it('POSTs to /auth/mfa/recovery-codes/regenerate with credentials', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ recoveryCodes: ['aaaaa-bbbbb'] });

    await regenerateRecoveryCodes({ currentPassword: 'open-sesame' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mfa/recovery-codes/regenerate');
    expect((options as { method: string }).method).toBe('POST');
  });
});

describe('listApiTokens', () => {
  it('GETs /tokens with Authorization header', async () => {
    setStoredToken('my-jwt');
    const tokens = [
      {
        id: 'tok-1',
        name: 'Chrome',
        prefix: 'ltk_aBcDeFgH',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: null,
      },
    ];
    const fetchMock = mockFetch(tokens);

    const result = await listApiTokens();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tokens');
    expect((options as { method?: string }).method).toBeUndefined();
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBe('Bearer my-jwt');
    expect(result).toEqual(tokens);
  });
});

describe('createApiToken', () => {
  it('POSTs to /tokens with name in body', async () => {
    setStoredToken('my-jwt');
    const created = {
      id: 'tok-1',
      name: 'Chrome',
      prefix: 'ltk_aBcDeFgH',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: null,
      rawToken: 'ltk_aBcDeFgHiJkLmNoPqRsTuVwXyZ12',
    };
    const fetchMock = mockFetch(created, 201);

    const result = await createApiToken('Chrome');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tokens');
    expect((options as { method: string }).method).toBe('POST');
    const body = JSON.parse((options as { body: string }).body) as {
      name: string;
    };
    expect(body.name).toBe('Chrome');
    expect(result.rawToken).toBe(created.rawToken);
  });
});

describe('revokeApiToken', () => {
  it('DELETEs /tokens/:id with Authorization header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ success: true });

    const result = await revokeApiToken('tok-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tokens/tok-1');
    expect((options as { method: string }).method).toBe('DELETE');
    expect(result).toEqual({ success: true });
  });
});

describe('typed endpoints – ApiError guards on empty response body', () => {
  it('login throws ApiError when the server returns an empty body', async () => {
    mockFetchEmptyBody();
    await expect(login('a@b.co', 'pw')).rejects.toBeInstanceOf(ApiError);
  });

  it('verifyMagicLink throws ApiError when the server returns an empty body', async () => {
    mockFetchEmptyBody();
    await expect(verifyMagicLink('token')).rejects.toBeInstanceOf(ApiError);
  });

  it('verifyOtp throws ApiError when the server returns an empty body', async () => {
    mockFetchEmptyBody();
    await expect(verifyOtp('mfa', '123456', 'totp')).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('getMe throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
  });

  it('setupTotp throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(setupTotp()).rejects.toBeInstanceOf(ApiError);
  });

  it('verifyTotpSetup throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(verifyTotpSetup('123456')).rejects.toBeInstanceOf(ApiError);
  });

  it('regenerateRecoveryCodes throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(
      regenerateRecoveryCodes({ currentPassword: 'pw' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('initiateOAuthLink throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(initiateOAuthLink('google')).rejects.toBeInstanceOf(ApiError);
  });
});
