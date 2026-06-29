/*
 * Tests for `useAnnouncer` — the theme editor's single polite live region
 * driver. The load-bearing property is the clear-then-set re-trigger: an
 * IDENTICAL consecutive message must still re-announce (two saves in a row both
 * "Your theme saved." otherwise stay silent, since a live region only fires on
 * a text-node change). The message is also read at fire time, so a reason set
 * just before the count bump wins over the prior closure.
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
  it('renders nothing before the first save (count 0)', () => {
    const { result } = renderHook(() => useAnnouncer(0, 'Your theme saved.'));
    expect(result.current).toBe('');
  });

  it('announces the message once a save settles', () => {
    const { result, rerender } = renderHook(
      ({ count, message }) => useAnnouncer(count, message),
      { initialProps: { count: 0, message: 'Your theme saved.' } },
    );

    rerender({ count: 1, message: 'Your theme saved.' });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe('Your theme saved.');
  });

  it('re-announces an IDENTICAL consecutive message via clear-then-set', () => {
    const { result, rerender } = renderHook(
      ({ count, message }) => useAnnouncer(count, message),
      { initialProps: { count: 1, message: 'Your theme saved.' } },
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('Your theme saved.');

    // A second save with the SAME message bumps the count: the region must
    // clear to '' first so the re-set is a genuine text-node change.
    rerender({ count: 2, message: 'Your theme saved.' });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('Your theme saved.');
  });

  it('reads the latest message at fire time (consume-once reason wins)', () => {
    const { result, rerender } = renderHook(
      ({ count, message }) => useAnnouncer(count, message),
      { initialProps: { count: 0, message: 'Your theme saved.' } },
    );

    // The count bumps and the reason changes in the same render.
    rerender({ count: 1, message: 'Reverted to previous colors.' });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe('Reverted to previous colors.');
  });
});
