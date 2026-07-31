import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkeletonPresence } from './useSkeletonPresence';

const EXIT_MS = 300;

describe('useSkeletonPresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is present immediately while metadata is pending', () => {
    const { result } = renderHook(() => useSkeletonPresence(true, EXIT_MS));

    expect(result.current).toBe(true);
  });

  it('never mounts a skeleton for a link that arrives already settled', () => {
    const { result } = renderHook(() => useSkeletonPresence(false, EXIT_MS));

    expect(result.current).toBe(false);
  });

  it('stays present through the exit window after pending clears, then unmounts', () => {
    const { result, rerender } = renderHook(
      ({ pending }) => useSkeletonPresence(pending, EXIT_MS),
      { initialProps: { pending: true } },
    );

    rerender({ pending: false });
    // still mounted so the lift-out transition has time to play
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(EXIT_MS);
    });
    expect(result.current).toBe(false);
  });

  it('re-asserts and cancels the scheduled unmount when the link falls back to pending', () => {
    const { result, rerender } = renderHook(
      ({ pending }) => useSkeletonPresence(pending, EXIT_MS),
      { initialProps: { pending: true } },
    );

    rerender({ pending: false });
    act(() => {
      vi.advanceTimersByTime(EXIT_MS / 2);
    });

    rerender({ pending: true });
    expect(result.current).toBe(true);

    // the scheduled unmount was cleared, so it stays mounted past deadline
    act(() => {
      vi.advanceTimersByTime(EXIT_MS);
    });
    expect(result.current).toBe(true);
  });
});
