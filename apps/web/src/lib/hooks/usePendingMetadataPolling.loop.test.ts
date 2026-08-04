import {
  createMetadataPollLoop,
  METADATA_POLL_TIMING,
} from './usePendingMetadataPolling.loop';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Link } from '../api';
import type {
  MetadataPollLoop,
  VisibilitySource,
} from './usePendingMetadataPolling.loop';

const { initialIntervalMs, maxIntervalMs, requestDeadlineMs } =
  METADATA_POLL_TIMING;

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

/** The loop's own settle predicate, injected so the loop stays framework-free. */
function isSettled(link: Link): boolean {
  return Boolean(link.meta?.fetchedAt);
}

/**
 * A hand-driven visibility source: `set` flips the state and fires every
 * subscriber (the loop's pause/resume handler), and `listenerCount` proves the
 * loop attaches/detaches its listener exactly when the spec says.
 */
function makeVisibility() {
  let hidden = false;
  const listeners = new Set<() => void>();
  const source: VisibilitySource = {
    isHidden: () => hidden,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  return {
    source,
    set(state: 'visible' | 'hidden') {
      hidden = state === 'hidden';
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

let loop: MetadataPollLoop | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  loop?.stop();
  loop = undefined;
  vi.useRealTimers();
});

describe('createMetadataPollLoop', () => {
  it('arms the first poll at the initial interval and settles a link', async () => {
    const pollLink = vi.fn(async (id: string) => settled(id));
    const onSettled = vi.fn();
    const visibility = makeVisibility();

    loop = createMetadataPollLoop({
      getPendingIds: () => ['a'],
      pollLink,
      onSettled,
      isSettled,
      visibility: visibility.source,
      timing: METADATA_POLL_TIMING,
    });
    loop.start();

    await vi.advanceTimersByTimeAsync(initialIntervalMs);

    expect(pollLink).toHaveBeenCalledWith('a', expect.any(AbortSignal));
    expect(onSettled).toHaveBeenCalledWith(settled('a'));
  });

  it('drops a poll that comes back still pending without writing state', async () => {
    // a pending copy must never settle, or a settled card could revert
    const pollLink = vi.fn(async (id: string) => makeLink(id));
    const onSettled = vi.fn();
    const visibility = makeVisibility();

    loop = createMetadataPollLoop({
      getPendingIds: () => ['a'],
      pollLink,
      onSettled,
      isSettled,
      visibility: visibility.source,
      timing: METADATA_POLL_TIMING,
    });
    loop.start();

    await vi.advanceTimersByTimeAsync(initialIntervalMs);

    expect(pollLink).toHaveBeenCalledTimes(1);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('doubles the back-off between successive polls', async () => {
    const pollLink = vi.fn(async (id: string) => makeLink(id));
    const visibility = makeVisibility();

    loop = createMetadataPollLoop({
      getPendingIds: () => ['a'],
      pollLink,
      onSettled: vi.fn(),
      isSettled,
      visibility: visibility.source,
      timing: METADATA_POLL_TIMING,
    });
    loop.start();

    await vi.advanceTimersByTimeAsync(initialIntervalMs);
    expect(pollLink).toHaveBeenCalledTimes(1);

    // the next poll only fires after the doubled interval, not before
    await vi.advanceTimersByTimeAsync(2 * initialIntervalMs - 1);
    expect(pollLink).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(pollLink).toHaveBeenCalledTimes(2);
  });

  it('advances the round-robin cursor so every id polls when the set exceeds the cap', async () => {
    const polled: string[] = [];
    const pollLink = vi.fn(async (id: string) => {
      polled.push(id);
      return makeLink(id);
    });
    const visibility = makeVisibility();

    loop = createMetadataPollLoop({
      getPendingIds: () => ['a', 'b', 'c', 'd', 'e'],
      pollLink,
      onSettled: vi.fn(),
      isSettled,
      visibility: visibility.source,
      timing: METADATA_POLL_TIMING,
    });
    loop.start();

    // first tick respects the cap of three, in order from the cursor
    await vi.advanceTimersByTimeAsync(initialIntervalMs);
    expect(polled).toEqual(['a', 'b', 'c']);

    // the cursor carries into the next tick and wraps past the end
    await vi.advanceTimersByTimeAsync(2 * initialIntervalMs);
    expect(polled.slice(3)).toEqual(['d', 'e', 'a']);
    expect(new Set(polled)).toEqual(new Set(['a', 'b', 'c', 'd', 'e']));
  });

  it('resets the back-off and cursor when a new id joins across a restart', async () => {
    let pending = ['a'];
    const polled: string[] = [];
    const pollLink = vi.fn(async (id: string) => {
      polled.push(id);
      return makeLink(id);
    });
    const visibility = makeVisibility();

    loop = createMetadataPollLoop({
      getPendingIds: () => pending,
      pollLink,
      onSettled: vi.fn(),
      isSettled,
      visibility: visibility.source,
      timing: METADATA_POLL_TIMING,
    });
    loop.start();

    // mature the interval to the cap through repeated misses
    await vi.advanceTimersByTimeAsync(60_000);

    // a fresh save joins; restart with the new membership
    pending = ['b', 'a'];
    loop.stop();
    loop.start();
    polled.length = 0;

    // the new id lands within the reset initial interval, from cursor 0
    await vi.advanceTimersByTimeAsync(initialIntervalMs);
    expect(polled).toEqual(['b', 'a']);
  });

  it('keeps the matured back-off across a restart that only shrinks', async () => {
    // pins the new-id guard: a shrink with no new id must not rewind back-off
    let pending = ['a', 'b'];
    const pollLink = vi.fn(async (id: string) => makeLink(id));
    const visibility = makeVisibility();

    loop = createMetadataPollLoop({
      getPendingIds: () => pending,
      pollLink,
      onSettled: vi.fn(),
      isSettled,
      visibility: visibility.source,
      timing: METADATA_POLL_TIMING,
    });
    loop.start();

    await vi.advanceTimersByTimeAsync(60_000);

    // one id settles away; restart with the shrunk (no new id) membership
    pending = ['b'];
    loop.stop();
    loop.start();
    pollLink.mockClear();

    // nothing fires at the initial interval: a reset would have polled here
    await vi.advanceTimersByTimeAsync(initialIntervalMs);
    expect(pollLink).not.toHaveBeenCalled();

    // rotation resumes once the matured interval elapses
    await vi.advanceTimersByTimeAsync(maxIntervalMs - initialIntervalMs);
    expect(pollLink).toHaveBeenCalledWith('b', expect.any(AbortSignal));
  });

  describe('one batch in flight', () => {
    it('starts no second batch while a flap advances under the deadline, then resumes after it', async () => {
      // a hung request holds the gate; flapping must not stack a second batch
      const pollLink = vi.fn(
        (_id: string, signal: AbortSignal) =>
          new Promise<Link>((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
          }),
      );
      const visibility = makeVisibility();

      loop = createMetadataPollLoop({
        getPendingIds: () => ['a'],
        pollLink,
        onSettled: vi.fn(),
        isSettled,
        visibility: visibility.source,
        timing: METADATA_POLL_TIMING,
      });
      loop.start();

      await vi.advanceTimersByTimeAsync(initialIntervalMs);
      expect(pollLink).toHaveBeenCalledTimes(1);

      // flap repeatedly under the deadline; the in-flight gate holds at one
      for (let round = 0; round < 4; round += 1) {
        visibility.set('hidden');
        visibility.set('visible');
        await vi.advanceTimersByTimeAsync(initialIntervalMs);
      }
      expect(pollLink).toHaveBeenCalledTimes(1);

      // past the deadline the hung request aborts and rotation resumes
      await vi.advanceTimersByTimeAsync(requestDeadlineMs);
      expect(pollLink.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('request deadline', () => {
    it('aborts a poll that outlives its deadline and settles nothing', async () => {
      let capturedSignal: AbortSignal | undefined;
      const pollLink = vi.fn(
        (id: string, signal: AbortSignal) =>
          new Promise<Link>((resolve, reject) => {
            capturedSignal = signal;
            // would settle well past its deadline, but the abort lands first
            setTimeout(() => resolve(settled(id)), 30_000);
            signal.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted', 'AbortError'),
              ),
            );
          }),
      );
      const onSettled = vi.fn();
      const visibility = makeVisibility();

      loop = createMetadataPollLoop({
        getPendingIds: () => ['a'],
        pollLink,
        onSettled,
        isSettled,
        visibility: visibility.source,
        timing: METADATA_POLL_TIMING,
      });
      loop.start();

      await vi.advanceTimersByTimeAsync(initialIntervalMs);
      expect(capturedSignal?.aborted).toBe(false);

      // at the deadline the signal aborts; the late resolve then settles nothing
      await vi.advanceTimersByTimeAsync(requestDeadlineMs);
      expect(capturedSignal?.aborted).toBe(true);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(onSettled).not.toHaveBeenCalled();
    });
  });

  describe('visibility pause/resume', () => {
    it('attaches no listener and arms no timer when nothing is pending', async () => {
      const pollLink = vi.fn(async (id: string) => makeLink(id));
      const visibility = makeVisibility();

      loop = createMetadataPollLoop({
        getPendingIds: () => [],
        pollLink,
        onSettled: vi.fn(),
        isSettled,
        visibility: visibility.source,
        timing: METADATA_POLL_TIMING,
      });
      loop.start();

      expect(visibility.listenerCount()).toBe(0);

      await vi.advanceTimersByTimeAsync(120_000);
      expect(pollLink).not.toHaveBeenCalled();
    });

    it('defers the first poll while hidden, then polls on resume', async () => {
      const pollLink = vi.fn(async (id: string) => makeLink(id));
      const visibility = makeVisibility();
      visibility.set('hidden');

      loop = createMetadataPollLoop({
        getPendingIds: () => ['a'],
        pollLink,
        onSettled: vi.fn(),
        isSettled,
        visibility: visibility.source,
        timing: METADATA_POLL_TIMING,
      });
      loop.start();

      // a hidden mount attaches the listener but arms no poll
      expect(visibility.listenerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(pollLink).not.toHaveBeenCalled();

      // resume arms the deferred first poll at the initial interval
      visibility.set('visible');
      await vi.advanceTimersByTimeAsync(initialIntervalMs);
      expect(pollLink).toHaveBeenCalledWith('a', expect.any(AbortSignal));
    });

    it('parks the timer while hidden and resumes at the reset interval', async () => {
      const pollLink = vi.fn(async (id: string) => makeLink(id));
      const visibility = makeVisibility();

      loop = createMetadataPollLoop({
        getPendingIds: () => ['a'],
        pollLink,
        onSettled: vi.fn(),
        isSettled,
        visibility: visibility.source,
        timing: METADATA_POLL_TIMING,
      });
      loop.start();

      await vi.advanceTimersByTimeAsync(initialIntervalMs);
      expect(pollLink).toHaveBeenCalledTimes(1);

      // hidden: the timer is parked, no further polls even far past the cap
      visibility.set('hidden');
      await vi.advanceTimersByTimeAsync(120_000);
      expect(pollLink).toHaveBeenCalledTimes(1);

      // visible: the reset back-off arms the next poll within the initial 2s
      visibility.set('visible');
      await vi.advanceTimersByTimeAsync(initialIntervalMs);
      expect(pollLink).toHaveBeenCalledTimes(2);
    });

    it('does not reschedule when an in-flight batch settles while hidden', async () => {
      // a resolve after hide must not reschedule; the loop stays parked
      let resolvePoll: () => void = () => {};
      const pollLink = vi.fn(
        () =>
          new Promise<Link>((resolve) => {
            resolvePoll = () => resolve(makeLink('a'));
          }),
      );
      const visibility = makeVisibility();

      loop = createMetadataPollLoop({
        getPendingIds: () => ['a'],
        pollLink,
        onSettled: vi.fn(),
        isSettled,
        visibility: visibility.source,
        timing: METADATA_POLL_TIMING,
      });
      loop.start();

      await vi.advanceTimersByTimeAsync(initialIntervalMs);
      expect(pollLink).toHaveBeenCalledTimes(1);

      // hide, then let the in-flight batch settle: it parks, no reschedule
      visibility.set('hidden');
      resolvePoll();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(pollLink).toHaveBeenCalledTimes(1);

      // the guard was released though, so a later refocus resumes
      visibility.set('visible');
      await vi.advanceTimersByTimeAsync(initialIntervalMs);
      expect(pollLink).toHaveBeenCalledTimes(2);
    });

    it('resets the back-off on refocus while a batch is in flight, skipping the arm', async () => {
      // the reset lives outside the in-flight gate: the batch re-arms off the
      // reset interval, not the matured one, yet the refocus arms no new poll
      let releaseHang: () => void = () => {};
      let hangNext = false;
      const pollLink = vi.fn(() => {
        if (hangNext) {
          return new Promise<Link>((resolve) => {
            releaseHang = () => resolve(makeLink('a'));
          });
        }
        return Promise.resolve(makeLink('a'));
      });
      const visibility = makeVisibility();

      loop = createMetadataPollLoop({
        getPendingIds: () => ['a'],
        pollLink,
        onSettled: vi.fn(),
        isSettled,
        visibility: visibility.source,
        timing: METADATA_POLL_TIMING,
      });
      loop.start();

      // mature the interval to the cap through repeated misses
      await vi.advanceTimersByTimeAsync(60_000);

      // the next poll hangs: a batch in flight at the matured interval
      hangNext = true;
      await vi.advanceTimersByTimeAsync(initialIntervalMs);
      const countBeforeResume = pollLink.mock.calls.length;

      // refocus mid-flight resets the back-off but skips the arm
      visibility.set('hidden');
      visibility.set('visible');

      // the settling batch re-arms off the reset interval, firing at 4s not 16s
      releaseHang();
      await vi.advanceTimersByTimeAsync(2 * initialIntervalMs);
      expect(pollLink.mock.calls.length).toBe(countBeforeResume + 1);
    });
  });

  describe('teardown', () => {
    it('detaches the visibility listener and schedules nothing after stop', async () => {
      const pollLink = vi.fn(async (id: string) => makeLink(id));
      const visibility = makeVisibility();

      loop = createMetadataPollLoop({
        getPendingIds: () => ['a'],
        pollLink,
        onSettled: vi.fn(),
        isSettled,
        visibility: visibility.source,
        timing: METADATA_POLL_TIMING,
      });
      loop.start();
      expect(visibility.listenerCount()).toBe(1);

      loop.stop();
      expect(visibility.listenerCount()).toBe(0);

      // a later refocus reaches no listener, and no armed timer fires
      visibility.set('visible');
      await vi.advanceTimersByTimeAsync(120_000);
      expect(pollLink).not.toHaveBeenCalled();
    });

    it('does not reschedule when an in-flight poll resolves late after stop', async () => {
      // pins the cancelled guard: a late resolve after stop adds no timer
      let resolvePoll: (link: Link) => void = () => {};
      const pollLink = vi.fn(
        () =>
          new Promise<Link>((resolve) => {
            resolvePoll = resolve;
          }),
      );
      const visibility = makeVisibility();

      loop = createMetadataPollLoop({
        getPendingIds: () => ['a'],
        pollLink,
        onSettled: vi.fn(),
        isSettled,
        visibility: visibility.source,
        timing: METADATA_POLL_TIMING,
      });
      loop.start();

      await vi.advanceTimersByTimeAsync(initialIntervalMs);
      expect(pollLink).toHaveBeenCalledTimes(1);

      loop.stop();
      resolvePoll(makeLink('a'));
      await vi.advanceTimersByTimeAsync(120_000);
      expect(pollLink).toHaveBeenCalledTimes(1);
    });
  });
});
