import { getLink } from './api';
import { useEffect, useRef } from 'react';
import type { Link } from './api';

const INITIAL_INTERVAL_MS = 2_000;
const MAX_INTERVAL_MS = 16_000;
const MAX_ELAPSED_MS = 60_000;

export function useMetadataPolling(
  linkId: string | null,
  onSettled: (link: Link) => void,
): void {
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    if (!linkId) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let elapsed = 0;
    let intervalMs = INITIAL_INTERVAL_MS;

    function poll() {
      getLink(linkId as string)
        .then((link) => {
          if (link.meta?.fetchedAt) {
            onSettledRef.current(link);
            return;
          }
          elapsed += intervalMs;
          if (elapsed < MAX_ELAPSED_MS) {
            intervalMs = Math.min(intervalMs * 2, MAX_INTERVAL_MS);
            timeoutId = setTimeout(poll, intervalMs);
          }
        })
        .catch(() => {
          // stop polling on error
        });
    }

    timeoutId = setTimeout(poll, INITIAL_INTERVAL_MS);

    return () => clearTimeout(timeoutId);
  }, [linkId]);
}
