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
 * round-robin cursor keeps every pending link in rotation, so a set larger
 * than the cap still cycles all of its links through.
 */
const MAX_POLLS_PER_TICK = 3;

/**
 * Per-request deadline for a metadata poll. apiFetch carries a deadline of its
 * own, but it is per-leg: a 401 that refreshes and retries gets a fresh one on
 * each leg, so a slow round of both outlasts this window twice over. This
 * signal rides both legs, so the pair shares one window measured from the tick
 * instead of taking one apiece. That matters because a tick re-arms the shared
 * timer only once its whole Promise.all settles: one stalled poll would freeze
 * the rotation for every other pending card. Aborting at this deadline bounds
 * the stall, since the abort rejects like any other request error and the next
 * tick schedules normally. What it does not reach is the refresh itself, which
 * runs on its own deadline (see REFRESH_DEADLINE_MS in refreshLeg.ts), so
 * that leg is bounded too, just not by this signal.
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
