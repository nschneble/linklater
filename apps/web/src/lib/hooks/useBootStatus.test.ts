/*
 * Tests for `useBootStatus`, the boot interstitial's phase machine.
 *
 * The load-bearing properties are the two silences. A boot that resolves
 * before the threshold shows nothing and says nothing in either direction,
 * and a boot whose loading flag never clears never fabricates completion.
 * Between them sits the dwell, which stops the threshold from relocating
 * the flash instead of removing it.
 *
 * The second silence needs its clock advanced in more than one step. A
 * handover scheduled by a timer fires inside whichever advance is
 * running, but one scheduled by an effect re-running on the phase change
 * only registers as `act` exits, by which time a single advance has
 * already closed its window and nothing is left to catch it.
 *
 * Two of the four durations are also advanced by literals rather than by
 * themselves, because a test that steps by the constant it is testing
 * re-derives its expectation from whatever that constant says and passes
 * at every value. The two silences above bracket the threshold at exactly
 * a second, which is the project's own bar for owing feedback at all and
 * the boot the user complained about. The dwell is held above a tenth of
 * a second, the bar below which a screen shown is a screen that flashed;
 * where it sits above that is tuning.
 *
 * The remaining two carry no such number. The ready stagger asks only to
 * be a task of its own after the handover, and nothing normative sets how
 * long a polite region must hold its text before being emptied.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOT_CLEAR_MS,
  BOOT_DWELL_MS,
  BOOT_READY_DELAY_MS,
  BOOT_THRESHOLD_MS,
  useBootStatus,
} from './useBootStatus';

function renderBoot() {
  return renderHook(({ loading }) => useBootStatus(loading), {
    initialProps: { loading: true },
  });
}

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useBootStatus', () => {
  it('renders nothing and says nothing before a full second has passed', () => {
    const { result } = renderBoot();

    expect(result.current.phase).toBe('blank');
    expect(result.current.announcement).toBe('');

    advance(999);

    expect(result.current.phase).toBe('blank');
    expect(result.current.announcement).toBe('');
  });

  it('shows the interstitial and announces loading at a full second', () => {
    const { result } = renderBoot();

    advance(1000);

    expect(result.current.phase).toBe('interstitial');
    expect(result.current.announcement).toBe('Loading Linklater…');
  });

  it('holds the screen past the tenth of a second that reads as a flash', () => {
    const { result, rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS);
    act(() => rerender({ loading: false }));
    advance(99);

    expect(result.current.phase).toBe('interstitial');
  });

  it('stays silent forever when loading clears before the threshold', () => {
    const { result, rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS - 100);
    act(() => rerender({ loading: false }));

    expect(result.current.phase).toBe('app');
    expect(result.current.announcement).toBe('');

    advance(BOOT_THRESHOLD_MS + BOOT_READY_DELAY_MS + BOOT_CLEAR_MS);

    expect(result.current.phase).toBe('app');
    expect(result.current.announcement).toBe('');
  });

  it('holds the interstitial for the dwell when loading clears right after it appears', () => {
    const { result, rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS);
    act(() => rerender({ loading: false }));

    expect(result.current.phase).toBe('interstitial');

    advance(BOOT_DWELL_MS - 1);

    expect(result.current.phase).toBe('interstitial');

    advance(1);

    expect(result.current.phase).toBe('app');
  });

  it('hands over without further hold once the dwell has already elapsed', () => {
    const { result, rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS + BOOT_DWELL_MS + 500);
    act(() => rerender({ loading: false }));
    advance(0);

    expect(result.current.phase).toBe('app');
  });

  it('announces ready after the stagger, then empties the region', () => {
    const { result, rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS);
    act(() => rerender({ loading: false }));
    advance(BOOT_DWELL_MS);

    expect(result.current.announcement).toBe('Loading Linklater…');

    advance(BOOT_READY_DELAY_MS);

    expect(result.current.announcement).toBe('Linklater is ready.');

    advance(BOOT_CLEAR_MS);

    expect(result.current.announcement).toBe('');
  });

  it('never fabricates completion while loading stays true', () => {
    const { result } = renderBoot();

    advance(BOOT_THRESHOLD_MS);
    // second advance: an effect-scheduled handover is invisible to one
    advance(BOOT_DWELL_MS + BOOT_READY_DELAY_MS + 10_000);

    expect(result.current.phase).toBe('interstitial');
    expect(result.current.announcement).toBe('Loading Linklater…');
  });

  it('cancels its pending timers on unmount', () => {
    const { unmount } = renderBoot();

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
