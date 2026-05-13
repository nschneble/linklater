import { getLink } from './api';
import { useEffect, useRef } from 'react';
import type { Link } from './api';

/** How long to wait before making the first metadata poll after a link is saved. */
const INITIAL_INTERVAL_MS = 2_000;

/** Maximum back-off interval between polls. */
const MAX_INTERVAL_MS = 16_000;

/** Stop polling entirely after this many milliseconds have elapsed. */
const MAX_ELAPSED_MS = 60_000;

/**
 * Polls `GET /links/:id` with exponential back-off until the link metadata
 * has been fetched (`link.meta.fetchedAt` is set), then calls `onSettled`.
 *
 * This hook exists because metadata is fetched asynchronously by a
 * background job after a link is saved. The UI shows a placeholder while
 * metadata is pending, then animates in the real title and image once
 * `onSettled` fires and the link is updated in state.
 *
 * Polling strategy:
 * - First poll: 2 seconds after `linkId` is set.
 * - Each subsequent poll: interval doubles (2s → 4s… up to 16s).
 * - Stops after 60 seconds total elapsed time, with or without metadata.
 *
 * GOTCHA: `onSettled` is stored in a ref so the effect closure always
 * calls the latest version without needing `onSettled` in the dependency
 * array. Including `onSettled` would re-run the effect on every render.
 *
 * @param linkId - The UUID of the link to poll. Pass `null` to disable polling.
 * @param onSettled - Called with the updated link once `meta.fetchedAt` is non-null.
 */
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
          elapsed += intervalMs;
          if (elapsed < MAX_ELAPSED_MS) {
            intervalMs = Math.min(intervalMs * 2, MAX_INTERVAL_MS);
            timeoutId = setTimeout(poll, intervalMs);
          }
        });
    }

    timeoutId = setTimeout(poll, INITIAL_INTERVAL_MS);

    return () => clearTimeout(timeoutId);
  }, [linkId]);
}
