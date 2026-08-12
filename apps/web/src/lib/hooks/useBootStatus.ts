import { useEffect, useRef, useState } from 'react';

/** Wait before the boot screen is worth showing at all. */
export const BOOT_THRESHOLD_MS = 1000;

/** Floor on the boot screen's visible lifetime once it has appeared. */
export const BOOT_DWELL_MS = 400;

/** Gap between the app taking over and the ready message. */
export const BOOT_READY_DELAY_MS = 250;

/** How long the ready message stays in the region before it is emptied. */
export const BOOT_CLEAR_MS = 1000;

const LOADING_MESSAGE = 'Loading Linklater…';
const READY_MESSAGE = 'Linklater is ready.';

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
 * only when `loading` actually clears, never from a timer. The ready message
 * is staggered past the handover so it does not land in the same tick as
 * `usePendingNotice`'s mount-effect write, where a screen reader is liable to
 * report one polite region and drop the other. It is emptied afterwards so a
 * reader arriving later finds no stale text.
 *
 * `shownAt` and the latch are refs so the dev-only double invoke of effects
 * cannot produce a phantom announcement or a second dwell.
 */
export function useBootStatus(loading: boolean): {
  phase: BootPhase;
  announcement: string;
} {
  const [phase, setPhase] = useState<BootPhase>('blank');
  const [announcement, setAnnouncement] = useState('');
  const shownAt = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    if (!loading) return;
    const timeoutId = window.setTimeout(() => {
      shownAt.current = Date.now();
      announced.current = true;
      setPhase('interstitial');
      setAnnouncement(LOADING_MESSAGE);
    }, BOOT_THRESHOLD_MS);
    return () => window.clearTimeout(timeoutId);
  }, [loading]);

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
    const timeoutId = window.setTimeout(
      () => setAnnouncement(READY_MESSAGE),
      BOOT_READY_DELAY_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [phase]);

  useEffect(() => {
    if (announcement !== READY_MESSAGE) return;
    const timeoutId = window.setTimeout(
      () => setAnnouncement(''),
      BOOT_CLEAR_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [announcement]);

  return { phase, announcement };
}
