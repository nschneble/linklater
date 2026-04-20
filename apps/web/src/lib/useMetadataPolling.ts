import { useEffect, useRef } from 'react';
import type { Link } from './api';
import { getLink } from './api';

const POLL_INTERVAL_MS = 2_000;
const MAX_TICKS = 10; // 20 seconds total

export function useMetadataPolling(
  linkId: string | null,
  onSettled: (link: Link) => void,
): void {
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    if (!linkId) {
      return;
    }

    let ticks = 0;
    const intervalId = setInterval(() => {
      ticks += 1;

      getLink(linkId)
        .then((link) => {
          if (link.metaFetchedAt) {
            clearInterval(intervalId);
            onSettledRef.current(link);
          } else if (ticks >= MAX_TICKS) {
            clearInterval(intervalId);
          }
        })
        .catch(() => {
          clearInterval(intervalId);
        });
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [linkId]);
}
