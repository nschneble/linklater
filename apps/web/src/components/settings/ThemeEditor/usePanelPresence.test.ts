/*
 * Tests for usePanelPresence – keeps a panel mounted through its exit animation
 * so it fades out instead of snapping away, then unmounts. Reduced-motion users
 * unmount synchronously (no lingering invisible frame).
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelPresence } from './usePanelPresence';

const reducedMotionMock = vi.fn(() => false);
vi.mock('../../../lib/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reducedMotionMock(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotionMock.mockReturnValue(false);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('usePanelPresence', () => {
  it('renders immediately while active, not exiting', () => {
    const { result } = renderHook(({ active }) => usePanelPresence(active), {
      initialProps: { active: true },
    });
    expect(result.current.rendered).toBe(true);
    expect(result.current.exiting).toBe(false);
  });

  it('stays mounted and marked exiting until the animation window elapses', () => {
    const { result, rerender } = renderHook(
      ({ active }) => usePanelPresence(active),
      { initialProps: { active: true } },
    );

    act(() => rerender({ active: false }));
    // Still in the DOM, now animating out.
    expect(result.current.rendered).toBe(true);
    expect(result.current.exiting).toBe(true);

    act(() => vi.advanceTimersByTime(220));
    expect(result.current.rendered).toBe(false);
    expect(result.current.exiting).toBe(false);
  });

  it('re-renders immediately when re-activated mid-exit', () => {
    const { result, rerender } = renderHook(
      ({ active }) => usePanelPresence(active),
      { initialProps: { active: true } },
    );
    act(() => rerender({ active: false }));
    act(() => rerender({ active: true }));
    expect(result.current.rendered).toBe(true);
    expect(result.current.exiting).toBe(false);
  });

  it('unmounts synchronously for reduced-motion users (no wait)', () => {
    reducedMotionMock.mockReturnValue(true);
    const { result, rerender } = renderHook(
      ({ active }) => usePanelPresence(active),
      { initialProps: { active: true } },
    );
    act(() => rerender({ active: false }));
    expect(result.current.rendered).toBe(false);
  });
});
