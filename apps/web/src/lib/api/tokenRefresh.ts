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
 */

import {
  API_BASE_URL,
  clearStoredToken,
  getStoredRefreshToken,
  isRefreshTokenSuperseded,
  setStoredToken,
} from './storage';

let inFlightRefresh: Promise<boolean> | null = null;

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

async function performTokenRefresh(): Promise<boolean> {
  const spentRefreshToken = getStoredRefreshToken();

  if (!spentRefreshToken) {
    // no refresh token: the rejected access token is dead for good
    clearStoredToken();
    return false;
  }

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
        if (isRefreshTokenSuperseded(spentRefreshToken)) return true;
        clearStoredToken();
      }
      return false;
    }

    const data = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    setStoredToken(data.accessToken, data.refreshToken);
    return true;
  } catch {
    // network failure/abort reached no verdict, so keep tokens for retry
    return false;
  } finally {
    clearTimeout(deadlineTimeoutId);
  }
}

// dedup concurrent refreshes so N parallel 401s share one refresh call
export async function attemptTokenRefresh(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = performTokenRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}
