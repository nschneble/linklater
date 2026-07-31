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

    // poll carries a deadline AbortSignal alongside the id; assert both
    expect(apiModule.getLink).toHaveBeenCalledWith(
      'a',
      expect.any(AbortSignal),
    );
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
    // a pending copy must never hit state: could overwrite a settled card
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

    // first poll at 2s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(1);

    // second poll only after another 4s (doubled); nothing fires at +3999ms
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
    // a slow metadata job (pg-boss retry past a minute) must be caught
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

  it('keeps retrying after request errors and never gives up while rendered', async () => {
    vi.mocked(apiModule.getLink).mockRejectedValue(new Error('Not found'));

    renderPolling([makeLink('a')]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    const countAfterErrors = polledIds().length;
    expect(countAfterErrors).toBeGreaterThan(1);

    // errors must not stop a rendered card, even far past 60s
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

    // updateLink would settle the card in list state; simulate that here.
    rerender({ links: [settled('a')] });
    vi.mocked(apiModule.getLink).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });

    expect(apiModule.getLink).not.toHaveBeenCalled();
  });

  it('rotates through every pending link when the set exceeds the per-tick cap', async () => {
    // cap of 3 must not silently drop a link, or its aria-busy stays stale
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('pending'));
    const links = ['a', 'b', 'c', 'd', 'e'].map((id) => makeLink(id));

    renderPolling(links);

    // first tick respects the cap: exactly three of the five are polled
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(3);

    // the round-robin cursor covers the remaining links on the next tick
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

    // let the interval mature to the 16s cap through repeated misses
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    // a fresh save must snap the back-off back to ~2s, not the matured 16s
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

  it('does not reschedule after teardown when an in-flight poll resolves late', async () => {
    // pins the cancelled guard: late resolve after teardown adds no timer
    let resolvePoll: (link: Link) => void = () => {};
    vi.mocked(apiModule.getLink).mockImplementation(
      () =>
        new Promise<Link>((resolve) => {
          resolvePoll = resolve;
        }),
    );

    const { unmount } = renderPolling([makeLink('a')]);

    // first poll fires and its request is left unresolved
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(1);

    // tear the effect down, then let the in-flight request resolve late
    unmount();
    await act(async () => {
      resolvePoll(makeLink('a'));
      await vi.advanceTimersByTimeAsync(120000);
    });

    // no orphaned reschedule: the late resolve must not queue another tick
    expect(polledIds()).toHaveLength(1);
  });

  it('keeps the matured back-off when the pending set only shrinks', async () => {
    // pins the hasNewId guard: a shrink must not rewind the back-off
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
          return new Promise<Link>((resolve, reject) => {
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

      // past the deadline the stalled request aborts and rotation resumes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(14000);
      });
      expect(polledIds().length).toBeGreaterThan(countAfterFirstTick);
    });

    it('settles nothing from a poll that times out, even if it resolves late', async () => {
      // a timed-out poll writes no state; a late resolve is a no-op
      vi.mocked(apiModule.getLink).mockImplementation(
        (id, signal) =>
          new Promise<Link>((resolve, reject) => {
            // would resolve settled well after its deadline...
            setTimeout(() => resolve(settled(id)), 30000);
            // ...but the deadline aborts it first
            signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
          }),
      );
      const onSettled = vi.fn();

      renderPolling([makeLink('a')], onSettled);

      // past the deadline and the 30s late-resolve: the poll never settles
      await act(async () => {
        await vi.advanceTimersByTimeAsync(32000);
      });

      expect(onSettled).not.toHaveBeenCalled();
    });
  });

  describe('visibility awareness', () => {
    it('does not schedule any poll while mounted in a hidden tab', async () => {
      // a backgrounded tab makes no requests: the timer stays parked
      vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));
      setVisibility('hidden');

      renderPolling([makeLink('a')]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120000);
      });

      expect(apiModule.getLink).not.toHaveBeenCalled();
    });

    it('defers the first poll until a hidden-mounted tab becomes visible', async () => {
      vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));
      setVisibility('hidden');

      renderPolling([makeLink('a')]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(apiModule.getLink).not.toHaveBeenCalled();

      // on return to visible the deferred first poll fires within 2s
      await act(async () => {
        fireVisibility('visible');
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(apiModule.getLink).toHaveBeenCalledWith(
        'a',
        expect.any(AbortSignal),
      );
    });

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

    it('resets the back-off to the initial interval on refocus', async () => {
      // after refocus the first poll fires within 2s, not the matured 16s
      vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

      renderPolling([makeLink('a')]);

      // mature the interval to the 16s cap through repeated misses
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      const countBeforeHide = polledIds().length;

      // hidden across a long stretch: nothing polls
      await act(async () => {
        fireVisibility('hidden');
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(polledIds()).toHaveLength(countBeforeHide);

      // refocus arms one poll at the reset 2s, not the matured 16s
      await act(async () => {
        fireVisibility('visible');
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(countBeforeHide + 1);
    });

    it('writes no state on a visibility transition itself', async () => {
      // hide/show runs no request and settles nothing; skeleton stays
      vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));
      const onSettled = vi.fn();

      renderPolling([makeLink('a')], onSettled);

      await act(async () => {
        fireVisibility('hidden');
        fireVisibility('visible');
      });

      expect(apiModule.getLink).not.toHaveBeenCalled();
      expect(onSettled).not.toHaveBeenCalled();
    });

    it('treats visibility changes as no-ops when nothing is pending', async () => {
      const onSettled = vi.fn();

      renderPolling([settled('a')], onSettled);

      await act(async () => {
        fireVisibility('hidden');
        fireVisibility('visible');
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(apiModule.getLink).not.toHaveBeenCalled();
      expect(onSettled).not.toHaveBeenCalled();
    });

    it('keeps a single timer through a rapid hidden/visible flap', async () => {
      // one shared timer handle; flapping must not leave two live timers
      vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

      renderPolling([makeLink('a')]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // flap several times, ending visible
      await act(async () => {
        for (let round = 0; round < 5; round += 1) {
          fireVisibility('hidden');
          fireVisibility('visible');
        }
      });

      // one armed timer fires one poll; a leaked second fires an extra
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(2);
    });

    it('does not double-schedule when the tab flaps while a poll is in flight', async () => {
      // flap mid-flight: resume and resolve reschedule share one handle
      let resolvePoll: () => void = () => {};
      vi.mocked(apiModule.getLink).mockImplementation(
        () =>
          new Promise<Link>((resolve) => {
            resolvePoll = () => resolve(makeLink('a'));
          }),
      );

      renderPolling([makeLink('a')]);

      // first poll fires; its request is left in flight
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // flap hidden/visible while pending, then let it resolve
      await act(async () => {
        fireVisibility('hidden');
        fireVisibility('visible');
        resolvePoll();
      });

      // the in-flight poll backed off to 4s and superseded the resume's 2s
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // the single 4s timer then fires the next poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(2);
    });

    it('does not resume polling when an in-flight request lands after the tab hides', async () => {
      // a resolve after hide must not reschedule; loop stays parked
      let resolvePoll: () => void = () => {};
      vi.mocked(apiModule.getLink).mockImplementation(
        () =>
          new Promise<Link>((resolve) => {
            resolvePoll = () => resolve(makeLink('a'));
          }),
      );

      renderPolling([makeLink('a')]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // hide the tab, then resolve the in-flight request
      await act(async () => {
        fireVisibility('hidden');
        resolvePoll();
        await vi.advanceTimersByTimeAsync(120000);
      });

      // no reschedule happened while hidden
      expect(polledIds()).toHaveLength(1);
    });

    it('does not start a second batch when the tab flaps while one is in flight', async () => {
      // in-flight guard: a refocus mid-batch starts no second batch
      vi.mocked(apiModule.getLink).mockImplementation(
        (_id, signal) =>
          // hangs until its deadline aborts it; never settles on its own
          new Promise<Link>((_resolve, reject) => {
            signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
          }),
      );

      renderPolling([makeLink('a')]);

      // first poll fires at 2s; its request hangs, batch stays in flight
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // flap under the 10s deadline; a leaked timer would fire a poll
      await act(async () => {
        for (let round = 0; round < 4; round += 1) {
          fireVisibility('hidden');
          fireVisibility('visible');
          await vi.advanceTimersByTimeAsync(2000);
        }
      });
      expect(polledIds()).toHaveLength(1);

      // past the deadline the batch settles and rotation resumes, no stall
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(polledIds().length).toBeGreaterThan(1);
    });

    it('clears the in-flight guard when a batch settles hidden so a later refocus resumes', async () => {
      // a batch settling hidden must clear the guard or refocus won't poll
      let resolvePoll: () => void = () => {};
      vi.mocked(apiModule.getLink).mockImplementation(
        () =>
          new Promise<Link>((resolve) => {
            resolvePoll = () => resolve(makeLink('a'));
          }),
      );

      renderPolling([makeLink('a')]);

      // First poll fires; its request is left in flight (batch in flight).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // settle the batch hidden: it parks but must still release the guard
      await act(async () => {
        fireVisibility('hidden');
        resolvePoll();
        await vi.advanceTimersByTimeAsync(120000);
      });
      expect(polledIds()).toHaveLength(1);

      // refocus: guard cleared, the resume arms and the next poll fires
      await act(async () => {
        fireVisibility('visible');
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(2);
    });

    it('resets the back-off on refocus even while a batch is in flight, so the settling batch re-arms promptly', async () => {
      // reset lives outside the guard: batch re-arms off 2s not 16s
      let releaseHang: () => void = () => {};
      let hangNext = false;
      vi.mocked(apiModule.getLink).mockImplementation(() => {
        if (hangNext) {
          // hangs until the test settles it; refocus lands mid-batch
          return new Promise<Link>((resolve) => {
            releaseHang = () => resolve(makeLink('a'));
          });
        }
        // a miss keeps 'a' pending, so the back-off doubles toward 16s
        return Promise.resolve(makeLink('a'));
      });

      renderPolling([makeLink('a')]);

      // mature the interval to the 16s cap through repeated misses
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      // the next poll hangs, a batch in flight at the matured interval
      hangNext = true;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      const countBeforeResume = polledIds().length;

      // refocus mid-flight resets back-off, skips arming; batch re-arms
      await act(async () => {
        fireVisibility('hidden');
        fireVisibility('visible');
      });

      // a poll fires at 4s only if the resume reset the interval, not 16s
      await act(async () => {
        releaseHang();
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(polledIds()).toHaveLength(countBeforeResume + 1);
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
