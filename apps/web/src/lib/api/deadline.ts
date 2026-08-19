/**
 * The deadline every application request runs under.
 *
 * `apiFetch` had none, so a socket stalling mid-request left its promise
 * pending until the browser's own socket timeout, which can run to minutes.
 * A form awaiting one of those stays locked for as long as it hangs. The
 * abort rejects like any other network failure, so a caller's existing
 * catch paints it and its finally releases — no new error channel.
 *
 * A caller's own signal is composed in rather than replaced: `getLink`
 * hands the metadata poller's abort down through `options.signal`, and
 * dropping it would leave a stalled poll uncancellable. Only this module's
 * own abort is reworded, so a caller's cancel still arrives as the
 * `AbortError` its own code watches for. `AbortSignal.any` would say this
 * in a line, but it is Baseline newly-available (March 2024) and so lands
 * above the Safari 16.4 Tailwind v4 already asks for here. A missing static
 * would throw on every request rather than degrade, so the listener stays.
 *
 * Held at 10s to match the two deadlines already in the app,
 * `REFRESH_DEADLINE_MS` and the metadata poll's `REQUEST_DEADLINE_MS`. It
 * sits well above a healthy round trip on a slow connection and well under
 * the socket timeout it stands in for. `AbortSignal.timeout` is avoided for
 * the reason the refresh leg already gives: its internal timer is not
 * driven by the test suite's fake timers.
 */

import { ApiError } from './responses';

const REQUEST_DEADLINE_MS = 10_000;

const DEADLINE_MESSAGE = 'The server took too long to answer. Try again.';

export async function fetchWithinDeadline(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const deadlineController = new AbortController();
  // a caller's cancel aborts this controller too, so the signal can't tell
  let deadlineReached = false;
  const deadlineTimeoutId = setTimeout(() => {
    deadlineReached = true;
    deadlineController.abort();
  }, REQUEST_DEADLINE_MS);

  const callerSignal = options.signal;
  const abortOnCaller = () => deadlineController.abort();
  callerSignal?.addEventListener('abort', abortOnCaller, { once: true });
  if (callerSignal?.aborted) deadlineController.abort();

  try {
    return await fetch(url, { ...options, signal: deadlineController.signal });
  } catch (caught: unknown) {
    if (deadlineReached) throw new ApiError(DEADLINE_MESSAGE, 0);
    throw caught;
  } finally {
    clearTimeout(deadlineTimeoutId);
    callerSignal?.removeEventListener('abort', abortOnCaller);
  }
}
