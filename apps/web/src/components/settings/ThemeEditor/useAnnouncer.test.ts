/*
 * Tests for `useAnnouncer`, the theme editor's thin adapter over the shared
 * `useReannounce` live-region driver. The clear-then-set re-trigger, identical
 * consecutive re-announce, idle sentinel, and read-at-fire-time semantics are
 * owned and proved by `useReannounce` (see useReannounce.test.ts); this file
 * only proves the wrapper wires `savedCount`/`savedMessage` through with the
 * editor's 50ms delay.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnnouncer } from './useAnnouncer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAnnouncer', () => {
  it('delegates to useReannounce, announcing on the 50ms delay exactly', () => {
    const { result, rerender } = renderHook(
      ({ count, message }) => useAnnouncer(count, message),
      { initialProps: { count: 0, message: 'Your theme saved.' } },
    );

    rerender({ count: 1, message: 'Your theme saved.' });
    expect(result.current).toBe('');

    // one tick short of the delay: any shorter one would have landed
    act(() => {
      vi.advanceTimersByTime(49);
    });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('Your theme saved.');
  });
});
