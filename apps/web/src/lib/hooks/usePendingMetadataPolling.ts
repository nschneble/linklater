import { getLink } from '../api';
import { isMetadataPending, isMetadataSettled } from './linksData.utils';
import { createMetadataPollLoop } from './usePendingMetadataPolling.loop';
import { METADATA_POLL_TIMING } from './usePendingMetadataPolling.loop.types';
import { useEffect, useRef } from 'react';
import type { Link } from '../api';
import type { MetadataPollLoop } from './usePendingMetadataPolling.loop.types';

/**
 * Polls `GET /links/:id` for every rendered link whose metadata has not been
 * fetched yet (`!meta.fetchedAt`), settling each one in place as its metadata
 * lands. The pending set is derived from list state rather than a caller-owned
 * slot, so a link is polled no matter how it arrived pending: a fresh save, a
 * burst of saves, a mid-job page reload, pagination, or a visibility prepend.
 *
 * The concurrency loop itself (the shared timer, the exponential back-off, the
 * round-robin cursor, the one-batch-in-flight gate, the per-poll deadline, and
 * the visibility pause/resume) lives in `createMetadataPollLoop`
 * (usePendingMetadataPolling.loop.ts) so it is unit-testable without React.
 * This hook only wires the live pending set, the settle callback, and the
 * document's visibility into that loop, and starts/stops it as membership
 * changes.
 *
 * @param links - The rendered links; any entry missing `meta.fetchedAt` is polled.
 * @param onSettled - Called with the fresh link once `meta.fetchedAt` is present.
 */
export function usePendingMetadataPolling(
  links: Link[],
  onSettled: (link: Link) => void,
): void {
  const onSettledReference = useRef(onSettled);
  onSettledReference.current = onSettled;

  // ref-read so an unrelated list re-render never restarts the timer
  const pendingIds = links.filter(isMetadataPending).map((link) => link.id);
  const pendingIdsReference = useRef(pendingIds);
  pendingIdsReference.current = pendingIds;

  // one loop for the component's lifetime; the effect only starts/stops it
  const loopReference = useRef<MetadataPollLoop | undefined>(undefined);
  if (!loopReference.current) {
    loopReference.current = createMetadataPollLoop({
      getPendingIds: () => pendingIdsReference.current,
      pollLink: getLink,
      onSettled: (link) => onSettledReference.current(link),
      isSettled: isMetadataSettled,
      visibility: {
        isHidden: () => document.visibilityState === 'hidden',
        subscribe: (onChange) => {
          document.addEventListener('visibilitychange', onChange);
          return () =>
            document.removeEventListener('visibilitychange', onChange);
        },
      },
      timing: METADATA_POLL_TIMING,
    });
  }

  // order-independent key so the effect re-runs only on membership change
  const pendingKey = [...pendingIds].sort().join('\n');

  useEffect(() => {
    const loop = loopReference.current;
    loop?.start();
    return () => loop?.stop();
  }, [pendingKey]);
}
