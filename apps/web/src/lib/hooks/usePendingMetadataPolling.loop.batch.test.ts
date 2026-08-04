import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPollBatch } from './usePendingMetadataPolling.loop.batch';
import type { Link } from '../api';

const DEADLINE_MS = 10_000;

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

/** The loop's own settle predicate: a fetched link is settled. */
function isSettled(link: Link): boolean {
  return Boolean(link.meta?.fetchedAt);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runPollBatch', () => {
  it('deadlines each poll independently, so a fast poll clearing its own timer never disarms a hung sibling', async () => {
    // 'fast' settles at once and clears its own deadline in `finally`; 'slow'
    // hangs. Were the two polls to share one deadline, fast's clear would
    // disarm slow's abort and let the hung request wedge the batch. So slow
    // must still abort at its own deadline despite fast having cleared its own.
    let fastSignal: AbortSignal | undefined;
    let slowSignal: AbortSignal | undefined;
    const pollLink = vi.fn((id: string, signal: AbortSignal) => {
      if (id === 'fast') {
        fastSignal = signal;
        return Promise.resolve(settled('fast'));
      }
      slowSignal = signal;
      // hang until aborted; this poll never settles on its own
      return new Promise<Link>(() => {});
    });
    const onSettled = vi.fn();

    runPollBatch({
      batch: ['fast', 'slow'],
      deadlineMs: DEADLINE_MS,
      pollLink,
      onSettled,
      isSettled,
    });

    // fast settles and clears its own deadline; slow's is still armed
    await vi.advanceTimersByTimeAsync(0);
    expect(onSettled).toHaveBeenCalledWith(settled('fast'));
    expect(fastSignal?.aborted).toBe(false);
    expect(slowSignal?.aborted).toBe(false);

    // at the deadline slow still aborts, proving its timer was never cleared
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    expect(slowSignal?.aborted).toBe(true);
    expect(fastSignal?.aborted).toBe(false);
  });
});
