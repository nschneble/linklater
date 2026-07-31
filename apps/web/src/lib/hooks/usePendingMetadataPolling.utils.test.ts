import { describe, expect, it } from 'vitest';
import {
  nextInterval,
  selectPollBatch,
} from './usePendingMetadataPolling.utils';

describe('selectPollBatch', () => {
  it('returns the whole set when it fits within the cap', () => {
    const { batch, nextCursor } = selectPollBatch(['a', 'b'], 0, 3);
    expect(batch).toEqual(['a', 'b']);
    // Cursor advances by the number actually polled, not by the cap.
    expect(nextCursor).toBe(2);
  });

  it('polls only up to the cap when the set is larger', () => {
    const { batch, nextCursor } = selectPollBatch(
      ['a', 'b', 'c', 'd', 'e'],
      0,
      3,
    );
    expect(batch).toEqual(['a', 'b', 'c']);
    expect(nextCursor).toBe(3);
  });

  it('wraps round-robin so successive ticks cover every id', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const first = selectPollBatch(ids, 0, 3);
    const second = selectPollBatch(ids, first.nextCursor, 3);
    expect(first.batch).toEqual(['a', 'b', 'c']);
    // Cursor 3 wraps: d, e, then back to a.
    expect(second.batch).toEqual(['d', 'e', 'a']);
    const covered = new Set([...first.batch, ...second.batch]);
    expect(covered).toEqual(new Set(ids));
  });

  it('keeps a monotonic cursor pointing to the right slot after the set shrinks', () => {
    // A large cursor from earlier ticks must still land on a valid slot once
    // the set shrinks, so rotation never throws or skips.
    const { batch } = selectPollBatch(['b'], 42, 3);
    expect(batch).toEqual(['b']);
  });
});

describe('nextInterval', () => {
  it('doubles below the cap', () => {
    expect(nextInterval(2000, 16000)).toBe(4000);
    expect(nextInterval(4000, 16000)).toBe(8000);
  });

  it('holds at the cap once doubling would exceed it', () => {
    expect(nextInterval(8000, 16000)).toBe(16000);
    expect(nextInterval(16000, 16000)).toBe(16000);
  });
});
