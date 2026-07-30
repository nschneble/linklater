import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingMetadataPolling } from './usePendingMetadataPolling';
import type { Link } from '../api';

vi.mock('../api', () => ({
  getLink: vi.fn(),
}));

import * as apiModule from '../api';

function makeLink(id: string, overrides: Partial<Link> = {}): Link {
  return {
    id,
    url: `https://example.com/${id}`,
    meta: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

/** A settled copy of `id`: its metadata has been fetched (`fetchedAt` set). */
function settled(id: string): Link {
  return makeLink(id, {
    meta: { title: id, fetchedAt: '2026-01-01T00:01:00.000Z' },
  });
}

/** The link ids requested across every `getLink` call so far, in order. */
function polledIds(): string[] {
  return vi.mocked(apiModule.getLink).mock.calls.map((call) => call[0]);
}

function renderPolling(
  links: Link[],
  onSettled: (link: Link) => void = vi.fn(),
) {
  return renderHook(
    ({ links: current }: { links: Link[] }) =>
      usePendingMetadataPolling(current, onSettled),
    { initialProps: { links } },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePendingMetadataPolling', () => {
  it('does not poll when no link is pending', async () => {
    renderPolling([settled('a')]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(apiModule.getLink).not.toHaveBeenCalled();
  });

  it('polls a link that is already pending at initial load after 2 seconds', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

    renderPolling([makeLink('a')]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(apiModule.getLink).toHaveBeenCalledWith('a');
  });

  it('calls onSettled when a poll returns settled metadata', async () => {
    const link = settled('a');
    vi.mocked(apiModule.getLink).mockResolvedValue(link);
    const onSettled = vi.fn();

    renderPolling([makeLink('a')], onSettled);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSettled).toHaveBeenCalledWith(link);
  });

  it('does not call onSettled when a poll comes back still pending', async () => {
    // A pending copy must never be written to state: it would re-render for
    // nothing and could overwrite a card the client already settled (C3).
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));
    const onSettled = vi.fn();

    renderPolling([makeLink('a')], onSettled);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('doubles the interval between polls (exponential back-off)', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

    renderPolling([makeLink('a')]);

    // First poll at 2s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(1);

    // Second poll only after another 4s (doubled), so nothing fires at +3999ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3999);
    });
    expect(polledIds()).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(polledIds()).toHaveLength(2);
  });

  it('keeps polling past 60 seconds while a link stays pending', async () => {
    // The old poller gave up after 60s. A slow metadata job (a pg-boss retry
    // can land well past a minute) must still be caught.
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

    renderPolling([makeLink('a')]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    const countAtSixtySeconds = polledIds().length;
    expect(countAtSixtySeconds).toBeGreaterThan(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(polledIds().length).toBeGreaterThan(countAtSixtySeconds);
  });

  it('keeps retrying after request errors and never gives up while rendered (C2)', async () => {
    vi.mocked(apiModule.getLink).mockRejectedValue(new Error('Not found'));

    renderPolling([makeLink('a')]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    const countAfterErrors = polledIds().length;
    expect(countAfterErrors).toBeGreaterThan(1);

    // Well past the old 60s give-up: errors must not stop a rendered card.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(polledIds().length).toBeGreaterThan(countAfterErrors);
  });

  it('polls a second pending link without stranding the first (the old single-slot bug)', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

    const { rerender } = renderHook(
      ({ links }: { links: Link[] }) =>
        usePendingMetadataPolling(links, vi.fn()),
      { initialProps: { links: [makeLink('a')] } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toContain('a');

    // A second save prepends 'b'; both links are now pending in list state.
    rerender({ links: [makeLink('b'), makeLink('a')] });
    vi.mocked(apiModule.getLink).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const ids = polledIds();
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });

  it('stops polling a link once it has settled and left the pending set', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(settled('a'));
    const onSettled = vi.fn();

    const { rerender } = renderHook(
      ({ links }: { links: Link[] }) =>
        usePendingMetadataPolling(links, onSettled),
      { initialProps: { links: [makeLink('a')] } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onSettled).toHaveBeenCalledWith(settled('a'));

    // updateLink would settle the card in list state; simulate that here.
    rerender({ links: [settled('a')] });
    vi.mocked(apiModule.getLink).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });

    expect(apiModule.getLink).not.toHaveBeenCalled();
  });

  it('rotates through every pending link when the set exceeds the per-tick cap (C1)', async () => {
    // Five pending links, cap of three: no link may be silently dropped from
    // the polling set, or its aria-busy would stay stale forever.
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('pending'));
    const links = ['a', 'b', 'c', 'd', 'e'].map((id) => makeLink(id));

    renderPolling(links);

    // First tick respects the cap: exactly three of the five are polled.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(3);

    // The round-robin cursor covers the remaining links on the next tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(new Set(polledIds())).toEqual(new Set(['a', 'b', 'c', 'd', 'e']));
  });

  it('settles multiple links polled in the same tick', async () => {
    vi.mocked(apiModule.getLink).mockImplementation(async (id) => settled(id));
    const onSettled = vi.fn();

    renderPolling([makeLink('a'), makeLink('b')], onSettled);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const settledIds = onSettled.mock.calls.map((call) => call[0].id);
    expect(new Set(settledIds)).toEqual(new Set(['a', 'b']));
  });

  it('resets the back-off when a new link joins so it settles within the initial interval', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

    const { rerender } = renderHook(
      ({ links }: { links: Link[] }) =>
        usePendingMetadataPolling(links, vi.fn()),
      { initialProps: { links: [makeLink('a')] } },
    );

    // Let the interval mature to the 16s cap through repeated misses.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    // A fresh save joins the set; the back-off must snap back to ~2s rather
    // than inheriting the matured 16s interval.
    rerender({ links: [makeLink('b'), makeLink('a')] });
    vi.mocked(apiModule.getLink).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(polledIds()).toContain('b');
  });

  it('clears the timer when the hook unmounts before the first poll fires', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

    const { unmount } = renderPolling([makeLink('a')]);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(apiModule.getLink).not.toHaveBeenCalled();
  });
});
