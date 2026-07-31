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
 * GOTCHA: `onSettled` is read through a ref so the polling loop always calls the
 * latest closure without `onSettled` sitting in the effect's dependency array,
 * which would tear down and restart the timer on every render.
 *
 * GOTCHA: the visibility listener lives inside the same effect closure as the
 * timer so pause and resume share the one `timeoutId`. Every arm clears the
 * prior handle first, which is what keeps a hidden/visible flap (even with a
 * poll in flight) from leaving two live timers. The resume also skips arming
 * while a batch is in flight, so a rapid flap starts no second batch on top of
 * the one still running.
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
  // just because an unrelated list update re-rendered the hook. No dedup here:
  // upstream list state keeps ids unique (a create's prependLink drops any
  // prior copy, and a later page appends only ids not already loaded), so a
  // link can appear in the rendered list at most once.
  const pendingIds = links.filter(isMetadataPending).map((link) => link.id);
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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Whether a poll batch's requests are still in flight. A batch runs up to
    // the per-request deadline, so a firing timer or a visibility resume can
    // land while its requests are still pending. This gate holds concurrency to
    // one batch: neither path starts a second while one is in flight, and the
    // settling batch's own re-arm carries the rotation forward, so the gate
    // bounds overlap without stalling. It is a per-run flag, not a ref: a fresh
    // effect run (a membership change) gets its own `false` and polls the new
    // set at once rather than waiting out a now-irrelevant prior batch, whose
    // late result the `cancelled` guard already drops.
    let batchInFlight = false;

    // Arm the single shared timer, always clearing any prior handle first. That
    // clear is what makes a resume and an in-flight poll's reschedule converge
    // on one timer instead of leaving two live during a hidden/visible flap.
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
      // A batch is already in flight: a firing timer or a resume must not stack
      // a second on top of it. The in-flight batch's own re-arm resumes the
      // rotation when it settles, so skipping here loses no rotation. No current
      // path reaches this with a batch in flight (every arm site fires while the
      // flag is false and clears the prior timer, so the resume path carries the
      // flap behavior); it is kept as defense in depth so a future arm site
      // cannot silently stack a second batch.
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
          // Bound each poll with a client-side deadline so one hung request
          // cannot wedge the whole batch (see REQUEST_DEADLINE_MS). The timer
          // is cleared the moment the request settles so a healthy poll never
          // fires a pointless abort.
          const deadlineController = new AbortController();
          const deadlineTimeoutId = setTimeout(
            () => deadlineController.abort(),
            REQUEST_DEADLINE_MS,
          );
          return (
            getLink(id, deadlineController.signal)
              .then((link) => {
                // Only a settled poll writes state. Dropping a still-pending copy
                // avoids a pointless re-render and keeps a card the client
                // already settled from reverting to its skeleton.
                if (isMetadataSettled(link)) {
                  onSettledReference.current(link);
                }
              })
              // A failed or timed-out request is not terminal: swallow it and let
              // the next tick retry, so a rendered pending card is never
              // abandoned.
              .catch(() => {})
              .finally(() => clearTimeout(deadlineTimeoutId))
          );
        }),
      ).then(() => {
        // Release the in-flight gate first, before any early return, so a batch
        // that settles parked (torn down, or landed while hidden) still frees
        // the next batch to run once the loop re-arms.
        batchInFlight = false;
        if (cancelled) return;
        // A tab hidden mid-request must not resume polling when the request
        // lands: leave the timer parked until a visibilitychange re-arms it.
        if (document.visibilityState === 'hidden') return;
        if (pendingIdsReference.current.length > 0) {
          scheduleNext();
        }
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        // Pause: park the timer. No state write, so a rendered card keeps its
        // pending skeleton while the tab is backgrounded.
        clearTimeout(timeoutId);
        timeoutId = undefined;
      } else {
        // Resume: reset the back-off so a long-hidden tab does not wait out a
        // matured interval after refocus. Reset regardless of whether a batch
        // is in flight: if one is, the arm below is skipped, but the settling
        // batch's re-arm must still start from the initial interval rather than
        // inheriting the matured one. Only arm when nothing is in flight; an
        // in-flight batch re-arms itself on settle, so arming here would just
        // stack a second batch on top of it.
        intervalReference.current = INITIAL_INTERVAL_MS;
        if (!batchInFlight) {
          arm(INITIAL_INTERVAL_MS);
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Defer the first poll while mounted hidden; the listener above resumes it
    // once the tab becomes visible.
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
