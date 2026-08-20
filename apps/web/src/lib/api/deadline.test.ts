/**
 * Tests for the per-request deadline every application fetch runs under.
 *
 * `globalThis.fetch` is replaced so a request can be held open for as long
 * as a test needs, and the clock is faked so the deadline can be reached
 * without waiting for it. What lands here is the deadline's own arms: what
 * a request outliving it rejects with, that a settled request is untouched,
 * and that a caller's own signal survives being composed with this one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './responses';
import { fetchWithinDeadline } from './deadline';

const URL_UNDER_TEST = 'https://api.example.com/links';

function abortError() {
  return new DOMException('The operation was aborted', 'AbortError');
}

/**
 * A request that stays open until its signal aborts, as a stalled one does.
 * A signal already aborted at dispatch rejects at once, which is what the
 * real `fetch` does and what the pre-aborted arm below turns on.
 */
function stalledFetch() {
  return vi.fn((_url: string, options?: RequestInit) => {
    if (options?.signal?.aborted) return Promise.reject(abortError());
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(abortError()));
    });
  });
}

describe('fetchWithinDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects with a readable ApiError once a request outlives the deadline', async () => {
    globalThis.fetch = stalledFetch() as unknown as typeof fetch;

    const pending = fetchWithinDeadline(URL_UNDER_TEST, {}).catch(
      (caught: unknown) => caught,
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const caught = await pending;

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(0);
    expect((caught as ApiError).message).toBe('That took too long. Try again.');
  });

  it('leaves a request that answers in time alone', async () => {
    const response = new Response('{}', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchWithinDeadline(URL_UNDER_TEST, {})).resolves.toBe(
      response,
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    await vi.advanceTimersByTimeAsync(10_000);
    expect(options.signal?.aborted).toBe(false);
  });

  it('passes the caller options through untouched', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchWithinDeadline(URL_UNDER_TEST, {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(URL_UNDER_TEST);
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ Authorization: 'Bearer token' });
  });

  // the poller's catch reads the AbortError, so rewording it would break it
  it("aborts on the caller's own signal and rejects with its error, not the deadline's", async () => {
    globalThis.fetch = stalledFetch() as unknown as typeof fetch;
    const callerController = new AbortController();

    const pending = fetchWithinDeadline(URL_UNDER_TEST, {
      signal: callerController.signal,
    }).catch((caught: unknown) => caught);
    callerController.abort();
    const caught = await pending;

    expect(caught).not.toBeInstanceOf(ApiError);
    expect((caught as DOMException).name).toBe('AbortError');
  });

  it('honours a caller signal that had already aborted before the call', async () => {
    globalThis.fetch = stalledFetch() as unknown as typeof fetch;
    const callerController = new AbortController();
    callerController.abort();

    const caught = await fetchWithinDeadline(URL_UNDER_TEST, {
      signal: callerController.signal,
    }).catch((error: unknown) => error);

    expect((caught as DOMException).name).toBe('AbortError');
  });

  it('leaves no listener on a caller signal that outlives the request', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('{}')) as unknown as typeof fetch;
    const callerController = new AbortController();
    const removeSpy = vi.spyOn(callerController.signal, 'removeEventListener');

    await fetchWithinDeadline(URL_UNDER_TEST, {
      signal: callerController.signal,
    });

    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
