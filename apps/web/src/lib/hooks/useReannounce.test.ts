/*
 * Tests for `useReannounce`, the shared clear-then-set polite live-region
 * driver. The load-bearing property is that an IDENTICAL consecutive message
 * still re-announces: a live region only fires on a text-node change, so the
 * hook clears to '' the instant `trigger` changes, then re-sets after `delayMs`.
 * The message is read at fire time via a ref, so a value that changes after the
 * timer is scheduled (but before it fires) still wins over the prior closure.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReannounce } from './useReannounce';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useReannounce', () => {
  it('announces nothing while the trigger is the idle sentinel (0)', () => {
    const { result } = renderHook(() =>
      useReannounce(0, 'Your theme saved.', 50),
    );
    expect(result.current).toBe('');
  });

  it('re-sets the message after the delay once the trigger fires', () => {
    const { result, rerender } = renderHook(
      ({ trigger, message }) => useReannounce(trigger, message, 50),
      { initialProps: { trigger: 0, message: 'Your theme saved.' } },
    );

    rerender({ trigger: 1, message: 'Your theme saved.' });

    // cleared immediately on the trigger change; the message lands only after the delay
    expect(result.current).toBe('');
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe('Your theme saved.');
  });

  it('re-announces an IDENTICAL consecutive message via clear-then-set', () => {
    const { result, rerender } = renderHook(
      ({ trigger, message }) => useReannounce(trigger, message, 50),
      { initialProps: { trigger: 1, message: 'Your theme saved.' } },
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('Your theme saved.');

    // same message, bumped trigger: clear to '' first so the re-set is a real text-node change
    rerender({ trigger: 2, message: 'Your theme saved.' });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('Your theme saved.');
  });

  it('reads the latest message at fire time via the ref, NOT a stale closure', () => {
    const { result, rerender } = renderHook(
      ({ trigger, message }) => useReannounce(trigger, message, 50),
      { initialProps: { trigger: 0, message: 'Your theme saved.' } },
    );

    // bump the trigger with message A: fires the effect (clear + schedule the 50ms timer)
    rerender({ trigger: 1, message: 'Your theme saved.' });

    // message B, trigger fixed (effect won't re-run): isolates a ref READ vs a closure CAPTURE
    rerender({ trigger: 1, message: 'Reverted to previous colors.' });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    // ref read wins: the timer announces the latest message (B), not the captured A
    expect(result.current).toBe('Reverted to previous colors.');
  });

  it('honors a zero delay, defaulting when the argument is omitted', () => {
    const { result, rerender } = renderHook(
      ({ trigger, message }) => useReannounce(trigger, message),
      { initialProps: { trigger: 0, message: '2 new links added' } },
    );

    rerender({ trigger: 1, message: '2 new links added' });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe('2 new links added');
  });
});
