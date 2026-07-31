import { getLink } from '../api';
import { isMetadataPending, isMetadataSettled } from './linksData.utils';
import {
  nextInterval,
  selectPollBatch,
} from './usePendingMetadataPolling.utils';
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
 * Per-request deadline for a metadata poll. apiFetch imposes no timeout of its
 * own, so a hung socket (a dead network mid-request) would leave a getLink
 * pending until the browser's socket-level timeout, which can run to minutes.
 * Because a tick re-arms the shared timer only once its whole Promise.all
 * settles, one such stall would freeze the rotation for every other pending
 * card. Aborting at this deadline bounds the stall: the abort rejects like any
 * other request error and the next tick schedules normally. The signal bounds
 * the poll request itself; a 401 that sends apiFetch through a token refresh
 * runs that refresh leg on the refresh's own deadline (see REFRESH_DEADLINE_MS
 * in the api core), so that leg is bounded too, just not by this signal.
 *
 * The value sits above any healthy round-trip (a slow mobile connection
 * included, so a working-but-slow poll is not falsely aborted and left to
 * retry) yet well under the socket timeout it stands in for. It exceeds the
 * initial poll interval, but the loop tolerates that: the re-arm is gated on
 * the batch settling, so steady-state ticks never overlap; every schedule
 * routes through the single clear-first `arm`; a poll skips its run while a
 * batch is already in flight, so at most one batch runs at a time; and a
 * duplicate or late result is dropped by the `isMetadataSettled` guard. A
 * deadline longer than the interval therefore cannot pile up concurrent polls.
 */
const REQUEST_DEADLINE_MS = 10_000;

/**
 * Polls `GET /links/:id` for every rendered link whose metadata has not been
 * fetched yet (`!meta.fetchedAt`), settling each one in place as its metadata
 * lands. The pending set is derived from list state rather than a caller-owned
 * slot, so a link is polled no matter how it arrived pending: a fresh save, a
 * burst of saves, a mid-job page reload, pagination, or a visibility prepend.
 *
 * Polling strategy:
 * - One shared timer drives the whole pending set, not one timer per link.
 * - Each tick doubles the back-off between polls up to a ceiling (see
 *   INITIAL_INTERVAL_MS / MAX_INTERVAL_MS for the values).
 * - A tick polls at most MAX_POLLS_PER_TICK links, advancing a round-robin
 *   cursor so no pending card is ever starved.
 * - Each poll carries a client-side deadline (see REQUEST_DEADLINE_MS): a hung
 *   request is aborted so one stalled socket cannot freeze the shared timer's
 *   rotation for every other pending card.
 * - At most one poll batch is in flight at a time. A batch can run to the
 *   request deadline, so a firing timer or a visibility resume can arrive
 *   mid-batch; either is skipped while a batch is in flight, and the settling
 *   batch re-arms the loop, so overlap is bounded to one batch without
 *   stalling the rotation.
 * - A newly joined id resets the interval to its initial value, so a just-saved
 *   link settles within the initial interval instead of waiting out a mature
 *   interval left over from earlier links.
 * - Polling continues at the capped interval for as long as any pending link is
 *   rendered. There is no give-up: a slow metadata job (a pg-boss retry can
 *   land well past a minute) still gets caught, and a failed request just backs
 *   off and retries rather than abandoning the card in its skeleton.
 * - Only a poll that comes back settled writes state. A still-pending copy is
 *   dropped, both to avoid a pointless re-render and to keep a card the client
 *   already settled from reverting to its skeleton.
 * - Polling pauses while the tab is hidden (`document.visibilityState`): the
 *   timer is parked so a backgrounded tab issues no requests, and a poll in
 *   flight when the tab hides does not reschedule. On return to visible the
 *   back-off resets to its initial value and one poll is armed promptly, so a
 *   long-hidden tab settles without waiting out a matured interval. If a batch
 *   is still in flight on refocus, the resume resets the back-off but skips the
 *   arm, leaving that batch to re-arm the loop rather than stacking a second
 *   onto it. Pausing idles the transport only; it writes no state, so a
 *   rendered card keeps its pending skeleton (and `aria-busy`) while hidden. An
 *   empty pending set has no listener attached, so visibility changes are
 *   no-ops.
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

  // persist across renders so membership never rewinds the back-off
  const intervalReference = useRef(INITIAL_INTERVAL_MS);
  const cursorReference = useRef(0);
  const previousPendingReference = useRef<Set<string>>(new Set());

  // order-independent key so the effect re-runs only on membership change
  const pendingKey = [...pendingIds].sort().join('\n');

  useEffect(() => {
    const currentIds = pendingIdsReference.current;
    const previousPending = previousPendingReference.current;
    const hasNewId = currentIds.some((id) => !previousPending.has(id));
    previousPendingReference.current = new Set(currentIds);

    if (currentIds.length === 0) {
      // nothing pending: rest back-off so the next link settles fast
      intervalReference.current = INITIAL_INTERVAL_MS;
      return;
    }

    // a freshly joined id resets back-off + cursor so it lands next batch
    if (hasNewId) {
      intervalReference.current = INITIAL_INTERVAL_MS;
      cursorReference.current = 0;
    }

    // per-run flag so a post-teardown poll can't schedule a stale timer
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // gate holding poll concurrency to one batch at a time
    let batchInFlight = false;

    // clear the prior handle first so a flap can't leave two live timers
    function arm(delayMs: number) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(poll, delayMs);
    }

    function scheduleNext() {
      intervalReference.current = nextInterval(
        intervalReference.current,
        MAX_INTERVAL_MS,
      );
      arm(intervalReference.current);
    }

    function poll() {
      const ids = pendingIdsReference.current;
      if (ids.length === 0) return;
      // skip if a batch is already in flight so we never stack a second
      if (batchInFlight) return;

      const { batch, nextCursor } = selectPollBatch(
        ids,
        cursorReference.current,
        MAX_POLLS_PER_TICK,
      );
      cursorReference.current = nextCursor;

      batchInFlight = true;
      Promise.all(
        batch.map((id) => {
          // deadline each poll so one hung request can't wedge the batch
          const deadlineController = new AbortController();
          const deadlineTimeoutId = setTimeout(
            () => deadlineController.abort(),
            REQUEST_DEADLINE_MS,
          );
          return (
            getLink(id, deadlineController.signal)
              .then((link) => {
                // only a settled poll writes state, so no card reverts
                if (isMetadataSettled(link)) {
                  onSettledReference.current(link);
                }
              })
              // swallow failures; the next tick retries, no card abandoned
              .catch(() => {})
              .finally(() => clearTimeout(deadlineTimeoutId))
          );
        }),
      ).then(() => {
        // release the gate before any early return, even a parked batch
        batchInFlight = false;
        if (cancelled) return;
        // tab hidden mid-request: leave the timer parked till re-arm
        if (document.visibilityState === 'hidden') return;
        if (pendingIdsReference.current.length > 0) {
          scheduleNext();
        }
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        // pause: park the timer; no state write so the skeleton stays
        clearTimeout(timeoutId);
        timeoutId = undefined;
      } else {
        // resume: reset back-off so a refocus skips a matured interval
        intervalReference.current = INITIAL_INTERVAL_MS;
        if (!batchInFlight) {
          arm(INITIAL_INTERVAL_MS);
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // defer the first poll while mounted hidden; the listener resumes it
    if (document.visibilityState !== 'hidden') {
      arm(intervalReference.current);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pendingKey]);
}
