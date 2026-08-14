import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingMetadataPolling } from './usePendingMetadataPolling';
import type { Link } from '../api';

vi.mock('../api', () => ({
  getLink: vi.fn(),
}));

import * as apiModule from '../api';

/**
 * Covers what only the React layer can prove: the hook derives its
 * pending set from list state, injects the real getLink and the
 * production timing, wires the document's visibility into the loop, and
 * starts or stops that loop as membership changes or the component
 * unmounts. The loop's own state machine (back-off, rotation, in-flight
 * gating, pause and resume) is proved directly against the loop, batch
 * and interval helpers in the sibling suites, so it is not re-proved
 * through a hook harness here.
 */

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

/**
 * Overrides jsdom's `document.visibilityState` (a prototype getter) so the
 * polling hook's visibility branch can be exercised. Reset to 'visible' around
 * every test so an override never leaks into a sibling.
 */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
}

/** Flips visibility and dispatches the event the hook listens for. */
function fireVisibility(state: 'visible' | 'hidden') {
  setVisibility(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('usePendingMetadataPolling', () => {
  it('polls a link that is already pending at initial load after 2 seconds', async () => {
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

    renderPolling([makeLink('a')]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // poll carries a deadline AbortSignal alongside the id; assert both
    expect(apiModule.getLink).toHaveBeenCalledWith(
      'a',
      expect.any(AbortSignal),
    );
  });

  it('does not call onSettled when a poll comes back still pending', async () => {
    // pins the injected settle predicate: a pending copy writes no state
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));
    const onSettled = vi.fn();

    renderPolling([makeLink('a')], onSettled);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSettled).not.toHaveBeenCalled();
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

    // a second save prepends 'b'; both links are now pending in list state
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

    // updateLink would settle the card in list state; simulate that here
    rerender({ links: [settled('a')] });
    vi.mocked(apiModule.getLink).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });

    expect(apiModule.getLink).not.toHaveBeenCalled();
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

  it('keeps the matured back-off when the pending set only shrinks', async () => {
    // sole cover for the 16s ceiling: raise it and the last poll strands
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('pending'));

    const { rerender } = renderHook(
      ({ links }: { links: Link[] }) =>
        usePendingMetadataPolling(links, vi.fn()),
      { initialProps: { links: [makeLink('a'), makeLink('b')] } },
    );

    // let the interval mature to the 16s cap through repeated misses
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    // shrink with no new id must keep the back-off matured
    rerender({ links: [settled('a'), makeLink('b')] });
    vi.mocked(apiModule.getLink).mockClear();

    // nothing fires at the initial 2s: a reset would have polled here
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(0);

    // rotation continues once the matured interval elapses
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14000);
    });
    expect(polledIds()).toContain('b');
  });

  it('does not restart the poll timer when an unrelated settled sibling field changes', async () => {
    // keyed on membership, not links identity: sibling churn won't restart
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

    const { rerender } = renderHook(
      ({ links }: { links: Link[] }) =>
        usePendingMetadataPolling(links, vi.fn()),
      { initialProps: { links: [makeLink('a'), settled('b')] } },
    );

    // first poll at 2s; the next is scheduled 4s out (at t=6s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(1);

    // mid-wait a settled sibling's field changes; membership unchanged
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    rerender({
      links: [
        makeLink('a'),
        { ...settled('b'), readAt: '2026-07-29T00:00:00.000Z' },
      ],
    });

    // the scheduled poll still fires on time; a restart would push it out
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(2);
  });

  describe('request deadline', () => {
    it('keeps polling the other pending links after one request stalls past its deadline', async () => {
      // per-poll deadline: a hung request can't freeze the rotation
      vi.mocked(apiModule.getLink).mockImplementation((id, signal) => {
        if (id === 'stalled') {
          // never settles on its own; only the deadline's abort rejects it
          return new Promise<Link>((_resolve, reject) => {
            signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
          });
        }
        return Promise.resolve(makeLink(id));
      });

      renderPolling([makeLink('stalled'), makeLink('b')]);

      // stalled request hangs; without a deadline the batch never settles
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      const countAfterFirstTick = polledIds().length;

      // past the 10s deadline the request aborts and rotation resumes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(14000);
      });
      expect(polledIds().length).toBeGreaterThan(countAfterFirstTick);
    });
  });

  describe('visibility awareness', () => {
    it('stops polling once the tab hides and resumes when it returns', async () => {
      vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

      renderPolling([makeLink('a')]);

      // one poll fires while visible
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // hidden: no further polls, even far past the 16s cap
      await act(async () => {
        fireVisibility('hidden');
        await vi.advanceTimersByTimeAsync(120000);
      });
      expect(polledIds()).toHaveLength(1);

      // visible again: polling resumes
      await act(async () => {
        fireVisibility('visible');
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(2);
    });

    it('detaches the visibility listener on unmount so a later refocus polls nothing', async () => {
      // pins removeEventListener: refocus after unmount polls nothing
      vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

      const { unmount } = renderPolling([makeLink('a')]);

      unmount();

      await act(async () => {
        fireVisibility('visible');
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(apiModule.getLink).not.toHaveBeenCalled();
    });
  });
});
