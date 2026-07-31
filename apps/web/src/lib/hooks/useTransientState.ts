import { useEffect } from 'react';

/**
 * Schedules a reset of a transient state value back to its idle value after
 * `ms` milliseconds. Use for live-region announcement state that should be
 * emptied so the region is ready for the next change.
 *
 * Early-returns when `value === resetValue` so an idle state never schedules
 * a timer (and a screen reader announcement window stays open until the next
 * non-idle transition). Cancels the pending timer on unmount or on a fresh
 * non-idle transition so rapid sequences don't clobber each other.
 *
 * Default `ms` of 1500 matches the announcement window most polite live
 * regions need on modern screen readers; shortening risks missing the
 * announcement.
 *
 * @param value - The current state value to watch.
 * @param resetValue - The idle value the state returns to.
 * @param setter - The setter that flips state back to `resetValue`.
 * @param ms - The delay before resetting. Defaults to 1500.
 */
export function useTransientState<T>(
  value: T,
  resetValue: T,
  setter: (next: T) => void,
  ms = 1500,
): void {
  useEffect(() => {
    if (value === resetValue) return;
    const timeoutId = window.setTimeout(() => setter(resetValue), ms);
    return () => window.clearTimeout(timeoutId);
  }, [value, resetValue, setter, ms]);
}
