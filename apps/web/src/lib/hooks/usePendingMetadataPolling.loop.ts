import {
  nextInterval,
  selectPollBatch,
} from './usePendingMetadataPolling.utils';
import { runPollBatch } from './usePendingMetadataPolling.loop.batch';
import type {
  MetadataPollLoop,
  MetadataPollLoopOptions,
} from './usePendingMetadataPolling.loop.types';

/**
 * A framework-agnostic poll loop over a caller-owned pending set. `start`
 * (re)arms the loop for the current pending set; `stop` tears the current run
 * down. Membership changes are a `stop` then a `start`: the back-off (interval
 * + cursor) persists across runs, while each run gets a fresh cancelled / timer
 * / in-flight scope, so a superseded run's late-resolving batch drops its
 * result via its own cancelled flag rather than the new run's. This is the
 * concurrency state machine behind `usePendingMetadataPolling`, lifted out of
 * React so it is unit-testable with fake timers and an injected visibility
 * source, no rendering required.
 *
 * Polling strategy:
 * - One shared timer drives the whole pending set, not one timer per link.
 * - Each tick doubles the back-off between polls up to a ceiling (see
 *   METADATA_POLL_TIMING for the values).
 * - A tick polls at most `maxPollsPerTick` links, advancing a round-robin
 *   cursor so no pending card is ever starved.
 * - Each poll carries a client-side deadline (see `requestDeadlineMs`): a hung
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
 * - Polling continues at the capped interval for as long as any pending id is
 *   present. There is no give-up: a slow metadata job (a pg-boss retry can land
 *   well past a minute) still gets caught, and a failed request just backs off
 *   and retries rather than abandoning the card in its skeleton.
 * - Only a poll that comes back settled writes state. A still-pending copy is
 *   dropped, both to avoid a pointless re-render and to keep a card the client
 *   already settled from reverting to its skeleton.
 * - Polling pauses while the visibility source reports hidden: the timer is
 *   parked so a backgrounded tab issues no requests, and a poll in flight when
 *   the tab hides does not reschedule. On return to visible the back-off resets
 *   to its initial value and one poll is armed promptly, so a long-hidden tab
 *   settles without waiting out a matured interval. If a batch is still in
 *   flight on refocus, the resume resets the back-off but skips the arm, leaving
 *   that batch to re-arm the loop rather than stacking a second onto it. Pausing
 *   idles the transport only; it writes no state. An empty pending set has no
 *   listener attached, so visibility changes are no-ops.
 */
export function createMetadataPollLoop(
  options: MetadataPollLoopOptions,
): MetadataPollLoop {
  const { getPendingIds, pollLink, onSettled, isSettled, visibility, timing } =
    options;

  // persist across runs so a membership change never rewinds the back-off
  let interval = timing.initialIntervalMs;
  let cursor = 0;
  let previousPending = new Set<string>();

  // the current run's teardown; replaced on every start()
  let stopActiveRun: (() => void) | undefined;

  // one poll run with a fresh cancelled/timer/in-flight scope
  function beginRun(): () => void {
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
      interval = nextInterval(interval, timing.maxIntervalMs);
      arm(interval);
    }

    function poll() {
      const ids = getPendingIds();
      if (ids.length === 0) return;
      // skip if a batch is already in flight so we never stack a second
      if (batchInFlight) return;

      const { batch, nextCursor } = selectPollBatch(
        ids,
        cursor,
        timing.maxPollsPerTick,
      );
      cursor = nextCursor;

      batchInFlight = true;
      runPollBatch({
        batch,
        deadlineMs: timing.requestDeadlineMs,
        pollLink,
        onSettled,
        isSettled,
      }).then(() => {
        // release the gate before any early return, even a parked batch
        batchInFlight = false;
        if (cancelled) return;
        // tab hidden mid-request: leave the timer parked till re-arm
        if (visibility.isHidden()) return;
        if (getPendingIds().length > 0) {
          scheduleNext();
        }
      });
    }

    function handleVisibilityChange() {
      if (visibility.isHidden()) {
        // pause: park the timer; no state write so the skeleton stays
        clearTimeout(timeoutId);
        timeoutId = undefined;
      } else {
        // resume: reset back-off so a refocus skips a matured interval
        interval = timing.initialIntervalMs;
        if (!batchInFlight) {
          arm(timing.initialIntervalMs);
        }
      }
    }

    const unsubscribe = visibility.subscribe(handleVisibilityChange);

    // defer the first poll while mounted hidden; the listener resumes it
    if (!visibility.isHidden()) {
      arm(interval);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }

  function start() {
    const currentIds = getPendingIds();
    const hasNewId = currentIds.some((id) => !previousPending.has(id));
    previousPending = new Set(currentIds);

    if (currentIds.length === 0) {
      // nothing pending: reset back-off so the next link settles fast
      interval = timing.initialIntervalMs;
      stopActiveRun = undefined;
      return;
    }

    // a freshly joined id resets back-off + cursor so it lands next batch
    if (hasNewId) {
      interval = timing.initialIntervalMs;
      cursor = 0;
    }

    stopActiveRun = beginRun();
  }

  function stop() {
    stopActiveRun?.();
    stopActiveRun = undefined;
  }

  return { start, stop };
}
