/**
 * Renewal of an expired access token, and the single question a rejected
 * renewal has to answer: is this session over, or did another tab get to
 * the rotation first? Only the first warrants clearing the tokens, and
 * treating the second as the first is a logout the user never asked for.
 *
 * The second case needs no second network leg here: reporting success is
 * enough for `apiFetch` to retry with whatever access token the store now
 * serves. That token may still be the expired one, because the sibling's
 * two writes are not atomic (see `setStoredToken`) and its access token
 * can still be in flight. The retry then 401s and the caller sees that
 * error, which is the right outcome: one leg was spent finding out, the
 * session was never cleared, and the next request renews normally.
 *
 * The token being spent is read once, up front, because a re-read taken
 * later could land after that rotation and leave the guard comparing
 * against a value this request never sent.
 *
 * Whether a refusal ends the session is the caller's question, not this
 * module's, so the shared refresh reports an outcome and clears nothing.
 * A refusal is a verdict only for a caller the server has already turned
 * away; for one renewing ahead of a request it is a refusal of the
 * refresh token alone, and the access token it holds may still be good.
 * The distinction has to live outside the shared promise: every caller
 * awaits the same one, so a policy carried inside it would be whichever
 * caller happened to arrive first.
 */

import {
  API_BASE_URL,
  clearStoredToken,
  getStoredRefreshToken,
  isRefreshTokenSuperseded,
  setStoredToken,
} from './storage';

/**
 * What the renewal leg established, independent of who asked for it:
 * `renewed` when a usable access token is now stored, `refused` when the
 * server rejected the refresh token outright, `unresolved` when nothing
 * was established at all (a transient status, a network failure, an
 * abort). Only `refused` can end a session, and only for a caller
 * holding an access token the server has already turned away.
 */
type RefreshOutcome = 'renewed' | 'refused' | 'unresolved';

let inFlightRefresh: Promise<RefreshOutcome> | null = null;

/**
 * Deadline for the token-refresh fetch. apiFetch imposes no timeout of its
 * own, and every 401'd caller awaits this single shared refresh, so a
 * refresh hung on a dead network (a mid-request socket stall) would hold
 * every awaiter open until the browser's socket-level timeout, which can
 * run to minutes. Callers that carry their own per-request deadline still
 * could not escape it: the metadata poller's deadline bounds its poll but
 * explicitly does not cover the refresh leg it triggers. Bounding the
 * refresh here is the only place that leg gets a limit.
 *
 * An abort rejects the fetch exactly as an unreachable server would, so a
 * timed-out refresh follows the same catch below as any network failure:
 * this request fails, but the stored tokens survive because a refresh that
 * never answered has not proven the session dead. Held at 10s to match the
 * poller's per-request deadline: comfortably above a healthy round-trip on
 * a slow connection, well under the socket timeout it stands in for.
 * AbortSignal.timeout is deliberately avoided; its internal timer is not
 * driven by the test suite's fake timers.
 */
const REFRESH_DEADLINE_MS = 10_000;

async function performTokenRefresh(): Promise<RefreshOutcome> {
  const spentRefreshToken = getStoredRefreshToken();

  // nothing to renew with, which is a refusal reached without a leg
  if (!spentRefreshToken) return 'refused';

  // not wired to a caller's signal: one abort must not kill the refresh
  const deadlineController = new AbortController();
  const deadlineTimeoutId = setTimeout(
    () => deadlineController.abort(),
    REFRESH_DEADLINE_MS,
  );

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: spentRefreshToken }),
      signal: deadlineController.signal,
    });

    if (!response.ok) {
      // only a 401/403 can prove a token spent; others are transient
      if (response.status === 401 || response.status === 403) {
        // the successor another tab stored is live; the retry uses it
        if (isRefreshTokenSuperseded(spentRefreshToken)) return 'renewed';
        return 'refused';
      }
      return 'unresolved';
    }

    const data = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    setStoredToken(data.accessToken, data.refreshToken);
    return 'renewed';
  } catch {
    // network failure/abort reached no verdict, so keep tokens for retry
    return 'unresolved';
  } finally {
    clearTimeout(deadlineTimeoutId);
  }
}

// dedup concurrent refreshes so N parallel callers share one refresh call
function shareRefresh(): Promise<RefreshOutcome> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = performTokenRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

/**
 * Renewal for a caller whose access token the server has just refused,
 * answering whether the request is worth retrying. A refusal here is the
 * end of the session, because both halves of the pair have now been
 * turned away.
 */
export async function attemptTokenRefresh(): Promise<boolean> {
  const outcome = await shareRefresh();
  if (outcome === 'refused') clearStoredToken();
  return outcome === 'renewed';
}

/**
 * Renewal for a caller acting on its own clock, before the server has
 * seen the token at all. It clears nothing whatever the answer: the
 * access token it holds has not been refused by anyone, and throwing it
 * away on a hunch is the logout this module exists to prevent.
 */
export async function attemptSpeculativeRefresh(): Promise<void> {
  await shareRefresh();
}
