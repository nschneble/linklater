/**
 * The deadline every application request runs under. A caller's signal is
 * composed in rather than replaced, so a poller handing its abort down
 * stays cancellable; `AbortSignal.any` would say that in a line but lands
 * above the Safari 16.4 targeted here, and throws outright where absent.
 */

import { ApiError } from './responses';

const REQUEST_DEADLINE_MS = 10_000;

const DEADLINE_MESSAGE = 'That took too long. Try again.';

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
