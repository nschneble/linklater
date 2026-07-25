import { useEffect, useRef, useState } from 'react';

/**
 * Drives a polite live region that must re-announce even when the message
 * text is identical to the previous announcement. A live region only fires
 * on a text-node change, so this clears to '' the instant `trigger` changes,
 * then re-sets the message after `delayMs`, reading `message` via a ref at
 * FIRE time (not effect-run time) so a value that changes between scheduling
 * and firing still wins.
 *
 * `trigger` 0 is the idle sentinel: nothing is announced while it stays 0 (so
 * a region mounted before its first real announcement renders empty). Bump it
 * to a non-zero, ever-increasing value to fire.
 *
 * @param trigger - Bump this (e.g. a monotonic counter) each time an
 *   announcement should fire, even with unchanged `message`.
 * @param message - The text to announce. Read live via ref at fire time.
 * @param delayMs - Delay between the clear and the re-set. Defaults to 0.
 */
export function useReannounce(
  trigger: number,
  message: string,
  delayMs = 0,
): string {
  const [announcement, setAnnouncement] = useState('');

  const messageReference = useRef(message);
  messageReference.current = message;

  useEffect(() => {
    if (trigger === 0) return;
    setAnnouncement('');
    const timer = setTimeout(
      () => setAnnouncement(messageReference.current),
      delayMs,
    );
    return () => clearTimeout(timer);
    // `message` and `delayMs` are intentionally read at fire time, not deps:
    // the re-announce is keyed on `trigger` alone so an identical consecutive
    // message still fires, and a message that changes after scheduling wins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return announcement;
}
