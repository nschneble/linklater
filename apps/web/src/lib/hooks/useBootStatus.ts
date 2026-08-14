import {
  clearBootAnnouncementInbound,
  markBootAnnouncementInbound,
} from '../bootAnnouncementSignal';
import { noticeWasConsumed } from '../pendingNotice';
import { terminalBootMessage } from './useBootStatus.landing';
import { useEffect, useRef, useState } from 'react';
import type { BootLanding } from './useBootStatus.landing';

/** Wait before the boot screen is worth showing at all. */
export const BOOT_THRESHOLD_MS = 1000;

/** Floor on the boot screen's visible lifetime once it has appeared. */
export const BOOT_DWELL_MS = 400;

/**
 * Gap between the app taking over and the terminal message.
 *
 * What it buys is de-batching, not separation inside a tick: it pushes
 * this write into a task and a commit of its own, so it is not folded in
 * with `usePendingNotice`'s mount write and read as one region change
 * with the other dropped. Raising it cannot buy more. The only value
 * large enough to clear an eight-word utterance is large enough that the
 * message is no longer tied to the event it describes.
 *
 * `useOAuthArrivalError` waits four times as long for what looks like
 * the same event class on the same screen, and both stand. That one is
 * defending against a region populated during page load, which NVDA and
 * JAWS skip as part of the load, and nothing on its path supplies a
 * natural delay. This region has already changed once by now, a full
 * second in, so the load window it would be hiding behind is long shut.
 */
export const BOOT_READY_DELAY_MS = 250;

/** How long the ready message stays in the region before it is emptied. */
export const BOOT_CLEAR_MS = 1000;

const LOADING_MESSAGE = 'Loading Linklater…';

interface BootMessage {
  kind: 'none' | 'loading' | 'terminal';
  text: string;
}

export type BootPhase = 'blank' | 'interstitial' | 'app';

/**
 * Drives the boot screen and the polite region that narrates it.
 *
 * A boot that finishes inside `BOOT_THRESHOLD_MS` shows nothing, which is
 * the project's own "no feedback needed between 0.1s and 1.0s" line. Past
 * the threshold the screen appears and stays for at least `BOOT_DWELL_MS`,
 * because a threshold on its own does not remove the flash, it relocates it
 * to a boot resolving just after the boundary.
 *
 * The announcement is latched, not derived: a boot that never crossed the
 * threshold says nothing in either direction, and completion is announced
 * only when `loading` actually clears, never from a timer. What completion
 * says depends on where the boot came down, and `useBootStatus.landing.ts`
 * holds that table. It is emptied afterwards so a reader arriving later
 * finds no stale text.
 *
 * The landing is read from a ref inside the timeout rather than from the
 * argument the effect closed over, and all three reasons are load-bearing.
 * A crash is caught during the very commit that hands over, so it is not
 * known when the timer is set. A lazy route has not resolved by then
 * either. And keying the effect on the landing would let a crash minutes
 * later re-run it and fire a boot announcement for something that is not a
 * boot, which `/failwhale` puts one click away.
 *
 * The region is emptied on the strength of what kind of message is in it,
 * never of what the message says. Text equality was enough while there was
 * one terminal string; the moment there are several, and two of them are
 * the empty string, a comparison against any one of them leaves the region
 * holding the loading line for the rest of the session.
 *
 * `shownAt` and the latch are refs so the dev-only double invoke of effects
 * cannot produce a phantom announcement or a second dwell.
 *
 * Every argument above rests on one thing the code cannot state for
 * itself: nothing here runs backwards. `loading` falls once and is never
 * raised again, the phase only advances, and both latches only rise. Six
 * effects reading each other's state would need a far more careful order
 * if any of that could reverse, and the one that clears the inbound
 * signal on unmount is unreachable in the app for the same reason: `App`
 * unmounts only when the document is going away.
 */
export function useBootStatus(
  loading: boolean,
  landing: BootLanding,
): {
  phase: BootPhase;
  announcement: string;
} {
  const [phase, setPhase] = useState<BootPhase>('blank');
  const [message, setMessage] = useState<BootMessage>({
    kind: 'none',
    text: '',
  });
  const shownAt = useRef(0);
  const announced = useRef(false);
  const landingReference = useRef(landing);

  useEffect(() => {
    landingReference.current = landing;
  });

  useEffect(() => {
    if (!loading) return;
    const timeoutId = window.setTimeout(() => {
      shownAt.current = Date.now();
      announced.current = true;
      markBootAnnouncementInbound();
      setPhase('interstitial');
      setMessage({ kind: 'loading', text: LOADING_MESSAGE });
    }, BOOT_THRESHOLD_MS);
    return () => window.clearTimeout(timeoutId);
  }, [loading]);

  // a hook that went away is holding nothing off the inputs below it
  useEffect(() => clearBootAnnouncementInbound, []);

  useEffect(() => {
    if (loading || phase === 'app') return;
    if (phase === 'blank') {
      setPhase('app');
      return;
    }
    const remaining = Math.max(
      0,
      BOOT_DWELL_MS - (Date.now() - shownAt.current),
    );
    const timeoutId = window.setTimeout(() => setPhase('app'), remaining);
    return () => window.clearTimeout(timeoutId);
  }, [loading, phase]);

  useEffect(() => {
    if (phase !== 'app' || !announced.current) return;
    const timeoutId = window.setTimeout(() => {
      setMessage({
        kind: 'terminal',
        text: terminalBootMessage(
          landingReference.current,
          noticeWasConsumed(),
        ),
      });
      clearBootAnnouncementInbound();
    }, BOOT_READY_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [phase]);

  useEffect(() => {
    if (message.kind !== 'terminal') return;
    const timeoutId = window.setTimeout(
      () => setMessage({ kind: 'none', text: '' }),
      BOOT_CLEAR_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  return { phase, announcement: message.text };
}
