import {
  nextInterval,
  selectPollBatch,
} from './usePendingMetadataPolling.utils';
import type { Link } from '../api';

/** A tab-visibility signal the loop pauses on, independent of the DOM. */
export interface VisibilitySource {
  /** Whether the tab is currently hidden (polling pauses while true). */
  isHidden(): boolean;
  /** Subscribes to visibility changes; returns an unsubscribe teardown. */
  subscribe(onChange: () => void): () => void;
}

/** Timing knobs for the poll loop; injected so tests can drive their own. */
export interface MetadataPollLoopTiming {
  initialIntervalMs: number;
  maxIntervalMs: number;
  maxPollsPerTick: number;
  requestDeadlineMs: number;
}

/** Everything the framework-agnostic loop needs, injected by the caller. */
export interface MetadataPollLoopOptions {
  /** Live getter for the ids to poll; read fresh on every tick. */
  getPendingIds: () => string[];
  /** Fetches one link, cancellable via the deadline signal. */
  pollLink: (id: string, signal: AbortSignal) => Promise<Link>;
  /** Called with a link once its metadata has settled. */
  onSettled: (link: Link) => void;
  /** Whether a polled link has settled (only settled polls write state). */
  isSettled: (link: Link) => boolean;
  /** The pause/resume signal (tab visibility in the browser). */
  visibility: VisibilitySource;
  timing: MetadataPollLoopTiming;
}

/** A running poll loop: `start` (re)arms it, `stop` tears the run down. */
export interface MetadataPollLoop {
  start(): void;
  stop(): void;
}

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
 * duplicate or late result is dropped by the `isSettled` guard. A deadline
 * longer than the interval therefore cannot pile up concurrent polls.
 */
const REQUEST_DEADLINE_MS = 10_000;

/** The production timing the hook injects; tests supply their own. */
export const METADATA_POLL_TIMING: MetadataPollLoopTiming = {
  initialIntervalMs: INITIAL_INTERVAL_MS,
  maxIntervalMs: MAX_INTERVAL_MS,
  maxPollsPerTick: MAX_POLLS_PER_TICK,
  requestDeadlineMs: REQUEST_DEADLINE_MS,
};

/**
 * A framework-agnostic poll loop over a caller-owned pending set. `start`
 * (re)arms the loop for the current pending set; `stop` tears the current run
 * down. Membership changes are a `stop` then a `start`: the back-off (interval
 * + cursor) persists across runs, while each run gets a fresh cancelled / timer
 * / in-flight scope. This is the concurrency state machine behind
 * `usePendingMetadataPolling`, lifted out of React so it is unit-testable with
 * fake timers and an injected visibility source, no rendering required.
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

  // begins one poll run: a fresh cancelled / timer / in-flight scope over the
  // shared back-off. Per-run scoping is load-bearing: a fresh run polls the new
  // pending set at once, and a prior run's late-resolving batch drops its
  // result via that run's own cancelled flag rather than the new run's.
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
      Promise.all(
        batch.map((id) => {
          // deadline each poll so one hung request can't wedge the batch
          const deadlineController = new AbortController();
          const deadlineTimeoutId = setTimeout(
            () => deadlineController.abort(),
            timing.requestDeadlineMs,
          );
          return (
            pollLink(id, deadlineController.signal)
              .then((link) => {
                // only a settled poll writes state, so no card reverts
                if (isSettled(link)) {
                  onSettled(link);
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
