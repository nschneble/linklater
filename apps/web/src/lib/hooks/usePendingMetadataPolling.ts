import { getLink } from '../api';
import { useEffect, useRef } from 'react';
import type { Link } from '../api';

/** Delay before the first poll once a link enters the pending set. */
const INITIAL_INTERVAL_MS = 2_000;

/** Ceiling for the exponential back-off between polls. */
const MAX_INTERVAL_MS = 16_000;

/**
 * Upper bound on how many links a single tick polls. Most links settle within
 * a poll or two, so the pending set is usually tiny; the cap only bites when a
 * burst of saves or a mid-job page reload leaves many links pending at once,
 * and it stops that from firing one request per link at the same instant. The
 * round-robin cursor below keeps every pending link in rotation, so a set
 * larger than the cap still cycles all of its links through.
 */
const MAX_POLLS_PER_TICK = 3;

/**
 * Polls `GET /links/:id` for every rendered link whose metadata has not been
 * fetched yet (`!meta.fetchedAt`), settling each one in place as its metadata
 * lands. The pending set is derived from list state rather than a caller-owned
 * slot, so a link is polled no matter how it arrived pending: a fresh save, a
 * burst of saves, a mid-job page reload, pagination, or a visibility prepend.
 *
 * Polling strategy:
 * - One shared timer drives the whole pending set, not one timer per link.
 * - The first poll fires 2s after a link joins the set; each later tick doubles
 *   the interval up to a 16s cap.
 * - A tick polls at most MAX_POLLS_PER_TICK links, advancing a round-robin
 *   cursor so a set larger than the cap still cycles every link through and no
 *   pending card is ever starved.
 * - A newly joined id resets the interval back to 2s, so a just-saved link
 *   settles as quickly as it did under the old per-link poller instead of
 *   waiting out a mature interval left over from earlier links.
 * - Polling continues at the capped interval for as long as any pending link is
 *   rendered. There is no give-up: a slow metadata job (a pg-boss retry can
 *   land well past a minute) still gets caught, and a failed request just backs
 *   off and retries rather than abandoning the card in its skeleton.
 * - Only a poll that comes back settled writes state. A still-pending copy is
 *   dropped, both to avoid a pointless re-render and to keep a card the client
 *   already settled from reverting to its skeleton.
 *
 * GOTCHA: `onSettled` is read through a ref so the polling loop always calls the
 * latest closure without `onSettled` sitting in the effect's dependency array,
 * which would tear down and restart the timer on every render.
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

  // The live pending set, refreshed every render. The polling loop reads this
  // ref so it always targets the current links, and the timer never restarts
  // just because an unrelated list update re-rendered the hook.
  const pendingIds = links
    .filter((link) => !link.meta?.fetchedAt)
    .map((link) => link.id);
  const pendingIdsReference = useRef(pendingIds);
  pendingIdsReference.current = pendingIds;

  // The back-off interval, round-robin cursor, and previous membership persist
  // across renders and effect re-runs so a membership change never silently
  // rewinds the back-off or the rotation.
  const intervalReference = useRef(INITIAL_INTERVAL_MS);
  const cursorReference = useRef(0);
  const previousPendingReference = useRef<Set<string>>(new Set());

  // An order-independent key over the pending set. The effect below re-runs
  // only when membership actually changes, not on every list re-render.
  const pendingKey = [...pendingIds].sort().join('\n');

  useEffect(() => {
    const currentIds = pendingIdsReference.current;
    const previousPending = previousPendingReference.current;
    const hasNewId = currentIds.some((id) => !previousPending.has(id));
    previousPendingReference.current = new Set(currentIds);

    if (currentIds.length === 0) {
      // Nothing pending: no timer runs, and the back-off rests at its initial
      // value so the next link to arrive settles quickly.
      intervalReference.current = INITIAL_INTERVAL_MS;
      return;
    }

    // A freshly joined id (a save, a mid-job reload) restarts the back-off so
    // it settles within the initial interval instead of inheriting a mature
    // one. The cursor rewinds to the head too: a just-saved link is prepended
    // at index 0, so this puts it in the very next batch even when more than
    // MAX_POLLS_PER_TICK links are already pending.
    if (hasNewId) {
      intervalReference.current = INITIAL_INTERVAL_MS;
      cursorReference.current = 0;
    }

    // Per-run flag so a poll resolving after this effect was torn down (a
    // membership change or unmount) can never schedule a stale timer.
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      intervalReference.current = Math.min(
        intervalReference.current * 2,
        MAX_INTERVAL_MS,
      );
      timeoutId = setTimeout(poll, intervalReference.current);
    }

    function poll() {
      const ids = pendingIdsReference.current;
      if (ids.length === 0) return;

      const count = Math.min(MAX_POLLS_PER_TICK, ids.length);
      const start = cursorReference.current % ids.length;
      const batch: string[] = [];
      for (let offset = 0; offset < count; offset += 1) {
        batch.push(ids[(start + offset) % ids.length]);
      }
      cursorReference.current += count;

      Promise.all(
        batch.map((id) =>
          getLink(id)
            .then((link) => {
              // Only a settled poll writes state. Dropping a still-pending copy
              // avoids a pointless re-render and keeps a card the client
              // already settled from reverting to its skeleton.
              if (link.meta?.fetchedAt) {
                onSettledReference.current(link);
              }
            })
            // A failed request is not terminal: swallow it and let the next
            // tick retry, so a rendered pending card is never abandoned.
            .catch(() => {}),
        ),
      ).then(() => {
        if (cancelled) return;
        if (pendingIdsReference.current.length > 0) {
          scheduleNext();
        }
      });
    }

    timeoutId = setTimeout(poll, intervalReference.current);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [pendingKey]);
}
