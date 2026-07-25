import { useReannounce } from './useReannounce';
import { useTransientState } from './useTransientState';
import { useEffect, useState } from 'react';

/**
 * Bridges a conditionally-mounted `<Toast>` to an always-mounted live region.
 *
 * A Toast that is mounted only while `message` is non-null lets NVDA/JAWS miss
 * its first announcement – the live node isn't in the accessibility tree at
 * the moment the region would fire. This hook mirrors `message` into an
 * always-mounted `role="status"` region instead (render the Toast with
 * `announce={false}`), and empties that region after `ms` so a later reader
 * doesn't reach a stale message.
 *
 * The re-announce is delegated to the shared `useReannounce` clear-then-set
 * driver: each non-null message bumps an internal `trigger`, so the region
 * clears to '' before re-setting. Without that, the SAME message string firing
 * twice within the `ms` window would be a `setState(sameString)` bailout: the
 * text node never mutates, so a screen reader never announces the second event
 * (a WCAG 4.1.3 miss). Bumping the trigger forces a genuine text-node change.
 * The auto-clear is composed on top via `useTransientState`, which blanks the
 * pending message and bumps the trigger once more to settle the region to ''.
 *
 * `ms` defaults to 5000 to match Toast's success-variant auto-dismiss window.
 *
 * @param message - The current toast message (or `null`/'' when no toast).
 * @param ms - Delay before the region clears back to ''. Defaults to 5000.
 * @returns The announcement text for the always-mounted live region.
 */
export function useToastAnnouncement(
  message: string | null,
  ms = 5000,
): string {
  const [trigger, setTrigger] = useState(0);
  const [pendingMessage, setPendingMessage] = useState('');

  useEffect(() => {
    if (!message) return;
    setPendingMessage(message);
    setTrigger((current) => current + 1);
  }, [message]);

  const announcement = useReannounce(trigger, pendingMessage, 0);

  useTransientState(
    announcement,
    '',
    () => {
      setPendingMessage('');
      setTrigger((current) => current + 1);
    },
    ms,
  );

  return announcement;
}
