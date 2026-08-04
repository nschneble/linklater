import type { Link } from '../api';

/** What `runPollBatch` needs to fire one deadline-bounded poll per id. */
export interface RunPollBatchOptions {
  /** The ids to poll this tick, already selected by the round-robin cursor. */
  batch: string[];
  /** Per-request deadline; a poll outliving it is aborted. */
  deadlineMs: number;
  /** Fetches one link, cancellable via the deadline signal. */
  pollLink: (id: string, signal: AbortSignal) => Promise<Link>;
  /** Called with a link once its metadata has settled. */
  onSettled: (link: Link) => void;
  /** Whether a polled link has settled (only settled polls write state). */
  isSettled: (link: Link) => boolean;
}

/**
 * Fires one poll per id in `batch`, each under its own abort deadline, and
 * resolves once every poll settles. A settled link is handed to `onSettled`; a
 * still-pending copy is dropped so no already-settled card reverts. A failed
 * request is swallowed so the next tick just retries rather than abandoning a
 * card, and each poll's deadline timer is always cleared in `finally`. The
 * deadline bounds a hung socket so one stalled request cannot wedge the batch.
 */
export function runPollBatch({
  batch,
  deadlineMs,
  pollLink,
  onSettled,
  isSettled,
}: RunPollBatchOptions): Promise<void[]> {
  return Promise.all(
    batch.map((id) => {
      // deadline each poll so one hung request can't wedge the batch
      const deadlineController = new AbortController();
      const deadlineTimeoutId = setTimeout(
        () => deadlineController.abort(),
        deadlineMs,
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
  );
}
