import { useTransientState } from './useTransientState';
import { useEffect, useState } from 'react';

/**
 * Bridges a conditionally-mounted `<Toast>` to an always-mounted live region.
 *
 * A Toast that is mounted only while `message` is non-null lets NVDA/JAWS miss
 * its first announcement – the live node isn't in the accessibility tree at
 * the moment the region would fire. This hook mirrors `message` into local
 * state the instant it becomes non-empty, so a sibling always-mounted
 * `role="status"` region can do the announcing instead (render the Toast with
 * `announce={false}`). The mirror clears itself after `ms` so the region
 * empties and a repeat message re-announces.
 *
 * `ms` defaults to 5000 to match Toast's success-variant auto-dismiss window.
 *
 * @param message - The current toast message (or `null`/'' when no toast).
 * @param ms - Delay before the mirror clears back to ''. Defaults to 5000.
 * @returns The mirrored announcement text for the always-mounted live region.
 */
export function useToastAnnouncement(
  message: string | null,
  ms = 5000,
): string {
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (message) {
      setAnnouncement(message);
    }
  }, [message]);
  useTransientState(announcement, '', setAnnouncement, ms);
  return announcement;
}
