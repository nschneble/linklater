import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMetadataPolling } from './useMetadataPolling';
import type { Link } from './api';

vi.mock('./api', () => ({
  getLink: vi.fn(),
}));

import * as apiModule from './api';

const LINK_ID = 'link-1';
const LINK_URL = 'https://example.com/article';

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: LINK_ID,
    url: LINK_URL,
    meta: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMetadataPolling', () => {
  it('does not poll when linkId is null', async () => {
    renderHook(() => useMetadataPolling(null, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(apiModule.getLink).not.toHaveBeenCalled();
  });

  it('polls getLink after the initial 2 second delay', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink());

    renderHook(() => useMetadataPolling(LINK_ID, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(apiModule.getLink).toHaveBeenCalledWith(LINK_ID);
  });

  it('calls onSettled when meta.fetchedAt is present', async () => {
    const settledLink = makeLink({
      meta: { fetchedAt: '2026-01-01T00:01:00.000Z' },
    });
    vi.mocked(apiModule.getLink).mockResolvedValue(settledLink);
    const onSettled = vi.fn();

    renderHook(() => useMetadataPolling(LINK_ID, onSettled));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSettled).toHaveBeenCalledWith(settledLink);
  });

  it('does not call onSettled when meta.fetchedAt is absent', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink({ meta: null }));
    const onSettled = vi.fn();

    renderHook(() => useMetadataPolling(LINK_ID, onSettled));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('schedules a follow-up poll after a miss (exponential backoff)', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink({ meta: null }));

    renderHook(() => useMetadataPolling(LINK_ID, vi.fn()));

    // first poll at 2s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    const firstCallCount = (apiModule.getLink as ReturnType<typeof vi.fn>).mock
      .calls.length;
    expect(firstCallCount).toBeGreaterThanOrEqual(1);

    // second poll at 2s + 4s = 6s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    const secondCallCount = (apiModule.getLink as ReturnType<typeof vi.fn>).mock
      .calls.length;
    expect(secondCallCount).toBeGreaterThan(firstCallCount);
  });

  it('stops polling after an error from getLink', async () => {
    vi.mocked(apiModule.getLink).mockRejectedValue(new Error('Not found'));

    renderHook(() => useMetadataPolling(LINK_ID, vi.fn()));

    // allow first poll to fire and reject
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const callCountAfterError = (apiModule.getLink as ReturnType<typeof vi.fn>)
      .mock.calls.length;
    expect(callCountAfterError).toBeGreaterThanOrEqual(1);

    // no more polls after a long wait
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(
      (apiModule.getLink as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(callCountAfterError);
  });

  it('clears the timer when the hook unmounts before the first poll fires', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink({ meta: null }));

    const { unmount } = renderHook(() => useMetadataPolling(LINK_ID, vi.fn()));

    // unmount before the 2s timer fires
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(apiModule.getLink).not.toHaveBeenCalled();
  });

  it('stops scheduling new polls after MAX_ELAPSED_MS is exceeded', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink({ meta: null }));

    renderHook(() => useMetadataPolling(LINK_ID, vi.fn()));

    // advance well past the 60-second window
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70000);
    });

    const countAfterWindow = (apiModule.getLink as ReturnType<typeof vi.fn>)
      .mock.calls.length;

    // no additional polls should fire beyond this point
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(
      (apiModule.getLink as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(countAfterWindow);
  });
});
