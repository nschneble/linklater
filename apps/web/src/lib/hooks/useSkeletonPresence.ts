import { useEffect, useState } from 'react';

/**
 * Keeps a loading skeleton mounted through its exit animation.
 *
 * React has no native exit animation: a `{isPending && <skeleton/>}` block
 * unmounts the instant metadata settles, so a CSS lift-out transition never gets
 * to play. This holds the skeleton mounted for `exitDurationMs` after `isPending`
 * clears – long enough for the transition to run – then drops it so a settled
 * card carries no leftover skeleton DOM. A link that arrives already settled
 * never mounts one at all. If the link falls back to pending mid-exit (a
 * metadata refetch), the scheduled unmount is cancelled so the skeleton never
 * blinks out.
 */
export function useSkeletonPresence(
  isPending: boolean,
  exitDurationMs: number,
): boolean {
  const [isPresent, setIsPresent] = useState(isPending);

  useEffect(() => {
    if (isPending) {
      setIsPresent(true);
      return;
    }

    const unmountTimer = setTimeout(() => setIsPresent(false), exitDurationMs);
    return () => clearTimeout(unmountTimer);
  }, [isPending, exitDurationMs]);

  return isPresent;
}
