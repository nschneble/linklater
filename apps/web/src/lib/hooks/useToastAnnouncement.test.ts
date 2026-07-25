/*
 * Tests for `useToastAnnouncement`, the bridge from a conditionally-mounted
 * `<Toast>` to an always-mounted polite live region.
 *
 * The load-bearing property (WCAG 4.1.3): when the SAME message string fires
 * twice in a row within the auto-clear window, the second occurrence must
 * still re-announce. A live region only fires on a text-node change, so a
 * naive `setState(sameString)` bailout silently drops the second announcement.
 * The hook clears the region to '' before re-setting so the re-fire is a
 * genuine text-node change. Alongside that, a genuinely new message must still
 * announce immediately, and the region must empty after `ms`.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastAnnouncement } from './useToastAnnouncement';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useToastAnnouncement', () => {
  it('re-announces an IDENTICAL consecutive message fired within the window', () => {
    const { result, rerender } = renderHook(
      ({ message }: { message: string | null }) =>
        useToastAnnouncement(message, 5000),
      { initialProps: { message: null as string | null } },
    );

    // First save: the message lands after the (0ms) clear-then-set settles.
    rerender({ message: 'Link saved!' });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('Link saved!');

    // Part-way through the 5000ms window the region still holds the message.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe('Link saved!');

    // The Toast auto-dismisses (message → null) then the user saves again,
    // yielding the SAME string before the window elapses.
    rerender({ message: null });
    rerender({ message: 'Link saved!' });

    // The region must clear to '' first so the re-set is a real text-node
    // change — the buggy local-mirror bailed out here and left 'Link saved!'
    // in place, so no second announcement ever fired.
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('Link saved!');
  });

  it('announces a genuinely new, different message immediately', () => {
    const { result, rerender } = renderHook(
      ({ message }: { message: string | null }) =>
        useToastAnnouncement(message, 5000),
      { initialProps: { message: null as string | null } },
    );

    rerender({ message: 'Link saved!' });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('Link saved!');

    rerender({ message: 'Link deleted.' });
    // Cleared first, then the new text lands.
    expect(result.current).toBe('');
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('Link deleted.');
  });

  it('empties the region after the ms window elapses', () => {
    const { result, rerender } = renderHook(
      ({ message }: { message: string | null }) =>
        useToastAnnouncement(message, 5000),
      { initialProps: { message: null as string | null } },
    );

    rerender({ message: 'Link saved!' });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('Link saved!');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe('');
  });

  it('stays empty while message is null (idle)', () => {
    const { result } = renderHook(() => useToastAnnouncement(null, 5000));
    expect(result.current).toBe('');
  });
});
