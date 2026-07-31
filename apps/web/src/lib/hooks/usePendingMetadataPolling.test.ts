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

    // The poll carries a deadline signal alongside the id (see the request
    // deadline suite for why); assert both so the additive arg is documented.
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
    // A pending copy must never be written to state: it would re-render for
    // nothing and could overwrite a card the client already settled.
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

  it('keeps retrying after request errors and never gives up while rendered', async () => {
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

  it('rotates through every pending link when the set exceeds the per-tick cap', async () => {
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

  it('does not reschedule after teardown when an in-flight poll resolves late', async () => {
    // The post-resolve `if (cancelled) return;` guard is what stops a request
    // that lands after teardown from queuing an orphaned timer that keeps
    // polling a hook nobody renders. Deleting it survives every other test
    // here, so pin it: leave a request in flight, unmount, then resolve.
    let resolvePoll: (link: Link) => void = () => {};
    vi.mocked(apiModule.getLink).mockImplementation(
      () =>
        new Promise<Link>((resolve) => {
          resolvePoll = resolve;
        }),
    );

    const { unmount } = renderPolling([makeLink('a')]);

    // First poll fires and its request is left unresolved.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(1);

    // Tear the effect down, then let the in-flight request resolve late.
    unmount();
    await act(async () => {
      resolvePoll(makeLink('a'));
      await vi.advanceTimersByTimeAsync(120000);
    });

    // No orphaned reschedule: the late resolve must not queue another tick.
    expect(polledIds()).toHaveLength(1);
  });

  it('keeps the matured back-off when the pending set only shrinks', async () => {
    // Removing the `if (hasNewId)` guard would reset the interval on every
    // membership change, a shrink included. A set that loses a settled link
    // but stays non-empty must not rewind the back-off to its initial value.
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('pending'));

    const { rerender } = renderHook(
      ({ links }: { links: Link[] }) =>
        usePendingMetadataPolling(links, vi.fn()),
      { initialProps: { links: [makeLink('a'), makeLink('b')] } },
    );

    // Let the interval mature to the 16s cap through repeated misses.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    // 'a' settles and leaves the set; 'b' is still pending. Membership shrank
    // with no new id, so the back-off must stay matured.
    rerender({ links: [settled('a'), makeLink('b')] });
    vi.mocked(apiModule.getLink).mockClear();

    // At the initial 2s interval nothing fires: a reset would have polled here.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(0);

    // Rotation continues once the matured interval elapses.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14000);
    });
    expect(polledIds()).toContain('b');
  });

  it('does not restart the poll timer when an unrelated settled sibling field changes', async () => {
    // Keying the effect off `links` identity instead of the membership key
    // would restart the timer on every list re-render. A settled sibling whose
    // unrelated field changes must not disturb the pending link's cadence.
    vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

    const { rerender } = renderHook(
      ({ links }: { links: Link[] }) =>
        usePendingMetadataPolling(links, vi.fn()),
      { initialProps: { links: [makeLink('a'), settled('b')] } },
    );

    // First poll at 2s; the next is scheduled 4s out (at t=6s).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(1);

    // Two seconds into that 4s wait, a settled sibling's unrelated field
    // changes while pending membership ({a}) stays identical.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    rerender({
      links: [
        makeLink('a'),
        { ...settled('b'), readAt: '2026-07-29T00:00:00.000Z' },
      ],
    });

    // The originally-scheduled poll still fires on time (2s later). A timer
    // restart would have pushed it out and nothing would fire here.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(polledIds()).toHaveLength(2);
  });

  describe('request deadline', () => {
    it('keeps polling the other pending links after one request stalls past its deadline', async () => {
      // apiFetch has no timeout, so a hung request used to block the whole
      // Promise.all and freeze the rotation until the browser's socket-level
      // timeout (minutes). Each poll now carries a client-side deadline: the
      // stalled request aborts and the rotation continues for every other card.
      vi.mocked(apiModule.getLink).mockImplementation((id, signal) => {
        if (id === 'stalled') {
          // Never settles on its own; only the deadline's abort rejects it.
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

      // First tick fires; the stalled request hangs, so without a deadline the
      // batch's Promise.all never settles and no further tick is scheduled.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      const countAfterFirstTick = polledIds().length;

      // Past the 10s deadline and the next back-off: the stalled request aborts,
      // the batch settles, and the rotation schedules and fires the next tick.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(14000);
      });
      expect(polledIds().length).toBeGreaterThan(countAfterFirstTick);
    });

    it('settles nothing from a poll that times out, even if it resolves late', async () => {
      // A timed-out poll is a plain dropped error: it must write no state. Even
      // if the underlying request would have resolved settled afterwards, the
      // abort already rejected it, so an aborted promise stays rejected and the
      // late resolution is a no-op (dropped like any stale result).
      vi.mocked(apiModule.getLink).mockImplementation(
        (id, signal) =>
          new Promise<Link>((resolve, reject) => {
            // Would resolve settled well after its deadline...
            setTimeout(() => resolve(settled(id)), 30000);
            // ...but the deadline aborts it first.
            signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
          }),
      );
      const onSettled = vi.fn();

      renderPolling([makeLink('a')], onSettled);

      // Past the first poll (2s), its 10s deadline, and where the late resolve
      // (30s) would have landed: the timed-out poll never settles the card.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(32000);
      });

      expect(onSettled).not.toHaveBeenCalled();
    });
  });

  describe('visibility awareness', () => {
    it('does not schedule any poll while mounted in a hidden tab', async () => {
      // A backgrounded tab must make no metadata requests: the timer stays
      // parked, so advancing well past the 16s cap still fires nothing.
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

      // On return to visible the deferred first poll arms and fires promptly
      // (within the initial 2s), not after the matured interval.
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

      // One poll fires while visible.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // Hidden: no further polls, even far past the 16s cap.
      await act(async () => {
        fireVisibility('hidden');
        await vi.advanceTimersByTimeAsync(120000);
      });
      expect(polledIds()).toHaveLength(1);

      // Visible again: polling resumes.
      await act(async () => {
        fireVisibility('visible');
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(2);
    });

    it('resets the back-off to the initial interval on refocus', async () => {
      // A long-hidden tab must not wait out a matured 16s interval after
      // refocus: the first poll on return fires within the initial 2s.
      vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

      renderPolling([makeLink('a')]);

      // Mature the interval to the 16s cap through repeated misses.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      const countBeforeHide = polledIds().length;

      // Hidden across a long stretch: nothing polls.
      await act(async () => {
        fireVisibility('hidden');
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(polledIds()).toHaveLength(countBeforeHide);

      // Refocus arms one poll at the reset 2s interval, not the matured 16s.
      await act(async () => {
        fireVisibility('visible');
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(countBeforeHide + 1);
    });

    it('writes no state on a visibility transition itself', async () => {
      // Pausing is transport idling, not abandonment: hiding then showing runs
      // no request and settles nothing, so a rendered card keeps its skeleton
      // (aria-busy stays true, driven by the untouched data model).
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
      // Each transition shares the one timer handle, so flapping must not leave
      // two live timers that would double the poll rate after refocus.
      vi.mocked(apiModule.getLink).mockResolvedValue(makeLink('a'));

      renderPolling([makeLink('a')]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // Flap several times, ending visible.
      await act(async () => {
        for (let round = 0; round < 5; round += 1) {
          fireVisibility('hidden');
          fireVisibility('visible');
        }
      });

      // A single armed timer fires exactly one poll at the reset 2s interval.
      // A leaked second timer would fire an extra poll in the same window.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(2);
    });

    it('does not double-schedule when the tab flaps while a poll is in flight', async () => {
      // The real single-timer hazard: a request still in flight when the tab
      // flaps. The resume arms a timer and the in-flight resolve reschedules;
      // both must converge on one handle, not leave two live timers.
      let resolvePoll: () => void = () => {};
      vi.mocked(apiModule.getLink).mockImplementation(
        () =>
          new Promise<Link>((resolve) => {
            resolvePoll = () => resolve(makeLink('a'));
          }),
      );

      renderPolling([makeLink('a')]);

      // First poll fires; its request is left in flight.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // Flap hidden/visible while the request is pending, then let it resolve.
      await act(async () => {
        fireVisibility('hidden');
        fireVisibility('visible');
        resolvePoll();
      });

      // The in-flight poll completed and backed off to 4s, and the resume's
      // 2s timer was superseded rather than left live: nothing fires at +2s.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // The single 4s timer then fires the next poll.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(2);
    });

    it('does not resume polling when an in-flight request lands after the tab hides', async () => {
      // A request in flight when the tab hides must not reschedule on resolve:
      // the poll loop stays parked until a visibilitychange re-arms it.
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

      // Hide the tab, then resolve the in-flight request.
      await act(async () => {
        fireVisibility('hidden');
        resolvePoll();
        await vi.advanceTimersByTimeAsync(120000);
      });

      // No reschedule happened while hidden.
      expect(polledIds()).toHaveLength(1);
    });

    it('does not start a second batch when the tab flaps while one is in flight', async () => {
      // A batch runs up to the 10s request deadline. Each refocus resets the
      // back-off and arms a prompt poll; flapping faster than the batch settles
      // fired successive poll() runs, each dispatching another batch on top of
      // the one still in flight. The in-flight guard holds it to one: a refocus
      // (or a firing timer) while a batch is in flight starts no second batch.
      vi.mocked(apiModule.getLink).mockImplementation(
        (_id, signal) =>
          // Hangs until its deadline aborts it; never settles on its own.
          new Promise<Link>((_resolve, reject) => {
            signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
          }),
      );

      renderPolling([makeLink('a')]);

      // First poll fires at 2s; its request hangs, so the batch stays in flight.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(1);

      // Flap repeatedly while the batch is still in flight, advancing 2s after
      // each refocus so any leaked resume timer would fire a second poll. Stay
      // under the 10s deadline so the first batch is provably still pending.
      await act(async () => {
        for (let round = 0; round < 4; round += 1) {
          fireVisibility('hidden');
          fireVisibility('visible');
          await vi.advanceTimersByTimeAsync(2000);
        }
      });
      expect(polledIds()).toHaveLength(1);

      // Past the 10s deadline the hung request aborts, the batch settles, and
      // the rotation resumes: the guard bounds concurrency without stalling.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(polledIds().length).toBeGreaterThan(1);
    });

    it('clears the in-flight guard when a batch settles hidden so a later refocus resumes', async () => {
      // A batch in flight when the tab hides must clear the guard when it
      // settles, even though it parks rather than re-arms. Otherwise the guard
      // would survive and block every poll after the next refocus.
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

      // Hide, then settle the in-flight batch while hidden: it parks (no
      // re-arm) but must still release the guard.
      await act(async () => {
        fireVisibility('hidden');
        resolvePoll();
        await vi.advanceTimersByTimeAsync(120000);
      });
      expect(polledIds()).toHaveLength(1);

      // Refocus: with the guard cleared, the resume arms and the next poll fires.
      await act(async () => {
        fireVisibility('visible');
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(polledIds()).toHaveLength(2);
    });

    it('resets the back-off on refocus even while a batch is in flight, so the settling batch re-arms promptly', async () => {
      // The refocus resets the interval before the in-flight guard decides
      // whether to arm. If that reset sat inside the guard it would be skipped
      // whenever a batch is in flight, and the settling batch would re-arm off
      // the stale matured interval instead of the initial one. Mature the
      // back-off to the 16s cap, hang a batch in flight, refocus mid-flight,
      // then settle it: the next poll must arm off the reset interval (2s base,
      // so 4s after the doubling), not the matured 16s left over from before.
      let releaseHang: () => void = () => {};
      let hangNext = false;
      vi.mocked(apiModule.getLink).mockImplementation(() => {
        if (hangNext) {
          // Once matured, this poll hangs in flight until the test settles it,
          // so the refocus lands while a batch is running.
          return new Promise<Link>((resolve) => {
            releaseHang = () => resolve(makeLink('a'));
          });
        }
        // A miss keeps 'a' pending, so the back-off doubles toward the 16s cap.
        return Promise.resolve(makeLink('a'));
      });

      renderPolling([makeLink('a')]);

      // Mature the interval to the 16s cap through repeated misses.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      // The next poll hangs, leaving a batch in flight at the matured interval.
      hangNext = true;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      const countBeforeResume = polledIds().length;

      // Hide, then refocus while the batch is still in flight. The resume resets
      // the back-off but skips arming (the in-flight batch re-arms itself).
      await act(async () => {
        fireVisibility('hidden');
        fireVisibility('visible');
      });

      // Settle the batch visible and advance one reset-interval doubling (2s
      // base -> 4s). A poll fires here only if the resume reset the interval;
      // had it stayed at the matured 16s cap, nothing would fire until 16s.
      await act(async () => {
        releaseHang();
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(polledIds()).toHaveLength(countBeforeResume + 1);
    });

    it('detaches the visibility listener on unmount so a later refocus polls nothing', async () => {
      // The teardown's removeEventListener is what unpins the listener. Drop it
      // and a visibilitychange after unmount runs the stale resume path, which
      // arms a timer and polls getLink for a hook nobody renders. Unmount, fire
      // a refocus, and let the initial interval elapse: a live listener polls.
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
