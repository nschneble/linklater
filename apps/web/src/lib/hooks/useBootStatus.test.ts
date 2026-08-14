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
 *
 * The landing arrives as a second argument and is read at speak time, so
 * the cases below that change it mid-boot are the point rather than an
 * edge: the crash that decides the answer arrives during the commit that
 * hands over, after the timer carrying the message was already set. The
 * copy each landing resolves to is `useBootStatus.landing.test.ts`; what
 * is asked here is when the hook looks and what it does with a landing
 * that has nothing to say.
 *
 * Every landing is asked to empty the region, including the two that
 * withhold. Withholding leaves the loading text sitting in the node
 * otherwise, which is worse than the message it declined to send.
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
import {
  clearBootAnnouncementInbound,
  hasBootAnnouncementInbound,
} from '../bootAnnouncementSignal';
import { noticeWasConsumed } from '../pendingNotice';
import type { BootLanding } from './useBootStatus.landing';

vi.mock('../pendingNotice', () => ({
  noticeWasConsumed: vi.fn(() => false),
}));

function renderBoot(landing: BootLanding = 'app') {
  return renderHook(
    ({ loading, landing: current }) => useBootStatus(loading, current),
    { initialProps: { loading: true, landing } },
  );
}

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

/** Runs a boot slow enough to speak, up to the moment before it does. */
function bootPastTheThreshold(landing: BootLanding = 'app') {
  const boot = renderBoot(landing);

  advance(BOOT_THRESHOLD_MS);
  act(() => boot.rerender({ loading: false, landing }));
  advance(BOOT_DWELL_MS);

  return boot;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(noticeWasConsumed).mockReturnValue(false);
  clearBootAnnouncementInbound();
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
    act(() => rerender({ loading: false, landing: 'app' }));
    advance(99);

    expect(result.current.phase).toBe('interstitial');
  });

  it('stays silent forever when loading clears before the threshold', () => {
    const { result, rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS - 100);
    act(() => rerender({ loading: false, landing: 'app' }));

    expect(result.current.phase).toBe('app');
    expect(result.current.announcement).toBe('');

    advance(BOOT_THRESHOLD_MS + BOOT_READY_DELAY_MS + BOOT_CLEAR_MS);

    expect(result.current.phase).toBe('app');
    expect(result.current.announcement).toBe('');
  });

  it('holds the interstitial for the dwell when loading clears right after it appears', () => {
    const { result, rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS);
    act(() => rerender({ loading: false, landing: 'app' }));

    expect(result.current.phase).toBe('interstitial');

    advance(BOOT_DWELL_MS - 1);

    expect(result.current.phase).toBe('interstitial');

    advance(1);

    expect(result.current.phase).toBe('app');
  });

  it('hands over without further hold once the dwell has already elapsed', () => {
    const { result, rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS + BOOT_DWELL_MS + 500);
    act(() => rerender({ loading: false, landing: 'app' }));
    advance(0);

    expect(result.current.phase).toBe('app');
  });

  it('announces ready after the stagger, then empties the region', () => {
    const { result, rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS);
    act(() => rerender({ loading: false, landing: 'app' }));
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

describe('useBootStatus – what the boot landed on', () => {
  it('says so when the boot finished with nobody signed in', () => {
    const { result } = bootPastTheThreshold('signed-out');

    advance(BOOT_READY_DELAY_MS);

    expect(result.current.announcement).toBe(
      "Linklater is ready. You're not signed in.",
    );
  });

  it('stands down when a consumed notice already covered the landing', () => {
    vi.mocked(noticeWasConsumed).mockReturnValue(true);
    const { result } = bootPastTheThreshold('signed-out');

    advance(BOOT_READY_DELAY_MS);

    expect(result.current.announcement).toBe('');
  });

  it('goes on saying ready when the boot found somebody signed in', () => {
    vi.mocked(noticeWasConsumed).mockReturnValue(true);
    const { result } = bootPastTheThreshold('app');

    advance(BOOT_READY_DELAY_MS);

    expect(result.current.announcement).toBe('Linklater is ready.');
  });

  it('claims nothing when the boot ended on the error fallback', () => {
    const { result } = bootPastTheThreshold('error');

    advance(BOOT_READY_DELAY_MS);

    expect(result.current.announcement).toBe('');
  });

  // the crash lands during the handover commit, after the timer is set
  it('reads the landing when it speaks, not when it scheduled', () => {
    const { result, rerender } = bootPastTheThreshold('signed-out');

    act(() => rerender({ loading: false, landing: 'error' }));
    advance(BOOT_READY_DELAY_MS);

    expect(result.current.announcement).toBe('');
  });

  it('does not re-announce when a crash arrives long after the boot', () => {
    const { result, rerender } = bootPastTheThreshold('app');

    advance(BOOT_READY_DELAY_MS);
    // second advance: the clear is scheduled by an effect, not by a timer
    advance(BOOT_CLEAR_MS);

    expect(result.current.announcement).toBe('');

    act(() => rerender({ loading: false, landing: 'error' }));
    advance(BOOT_READY_DELAY_MS + BOOT_CLEAR_MS);

    expect(result.current.announcement).toBe('');
  });
});

describe('useBootStatus – emptying the region', () => {
  // the loading text outlives a withheld message otherwise
  it.each<BootLanding>(['app', 'signed-out', 'error'])(
    'empties the region after a boot that landed on %s',
    (landing) => {
      const { result } = bootPastTheThreshold(landing);

      expect(result.current.announcement).toBe('Loading Linklater…');

      advance(BOOT_READY_DELAY_MS);
      // second advance: the clear is scheduled by an effect, not by a timer
      advance(BOOT_CLEAR_MS);

      expect(result.current.announcement).toBe('');
    },
  );

  it('empties it for a suppressed signed-out landing too', () => {
    vi.mocked(noticeWasConsumed).mockReturnValue(true);
    const { result } = bootPastTheThreshold('signed-out');

    expect(result.current.announcement).toBe('Loading Linklater…');

    advance(BOOT_READY_DELAY_MS);
    advance(BOOT_CLEAR_MS);

    expect(result.current.announcement).toBe('');
  });
});

describe('useBootStatus – the focus signal', () => {
  it('leaves it down for a boot too fast to say anything', () => {
    const { rerender } = renderBoot();

    advance(BOOT_THRESHOLD_MS - 100);
    act(() => rerender({ loading: false, landing: 'app' }));
    advance(BOOT_READY_DELAY_MS + BOOT_CLEAR_MS);

    expect(hasBootAnnouncementInbound()).toBe(false);
  });

  it('raises it as soon as the boot screen speaks', () => {
    renderBoot();

    advance(BOOT_THRESHOLD_MS);

    expect(hasBootAnnouncementInbound()).toBe(true);
  });

  it('drops it once the terminal message has been resolved', () => {
    bootPastTheThreshold('signed-out');

    expect(hasBootAnnouncementInbound()).toBe(true);

    advance(BOOT_READY_DELAY_MS);

    expect(hasBootAnnouncementInbound()).toBe(false);
  });

  // a withheld message resolves the landing just the same
  it('drops it even when the landing had nothing to say', () => {
    bootPastTheThreshold('error');

    advance(BOOT_READY_DELAY_MS);

    expect(hasBootAnnouncementInbound()).toBe(false);
  });

  it('drops it when the hook goes away before it could speak', () => {
    const { unmount } = renderBoot();

    advance(BOOT_THRESHOLD_MS);
    unmount();

    expect(hasBootAnnouncementInbound()).toBe(false);
  });
});
