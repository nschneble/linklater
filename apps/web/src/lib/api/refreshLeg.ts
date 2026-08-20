/**
 * One leg to the refresh endpoint: how long it may take, and what a 2xx
 * from it is worth once it lands.
 *
 * Separate from `tokenRefresh` because the questions are different. Here:
 * did the server answer, and may this answer be written. There: whether a
 * refusal ends the session, and who is entitled to decide that. Both of
 * that module's legs come through here, so the deadline covers each of
 * them and neither can be wired to a caller's own signal.
 */

import {
  API_BASE_URL,
  isRefreshTokenSuperseded,
  setStoredToken,
} from './storage';

/**
 * What the renewal leg established, independent of who asked for it:
 * `renewed` when a successor to the spent token exists, so the store is
 * worth re-reading and the request worth sending; `refused` when the
 * server rejected the refresh token outright, or there was none to send;
 * `unresolved` when nothing was established at all (a transient status, a
 * network failure, an abort).
 *
 * `renewed` is not a promise that the token now stored is a fresh one.
 * The supersession branches store nothing, because the sibling that
 * rotated is the one writing, and its access token can still be in
 * flight; the retry then 401s and renews normally, as the header above
 * describes. Only `refused` can end a session, and only for a caller
 * holding an access token the server has already turned away.
 */
export type RefreshOutcome = 'renewed' | 'refused' | 'unresolved';

/**
 * Deadline for the token-refresh fetch. `postRefresh` goes to the network
 * through `fetch` directly, so apiFetch's deadline never covers this leg,
 * and every 401'd caller awaits this single shared refresh. A refresh hung
 * on a dead network (a mid-request socket stall) would hold every awaiter
 * open until the browser's socket-level timeout, which can run to minutes.
 * Callers that carry their own per-request deadline still could not escape
 * it: the metadata poller's deadline bounds its poll legs but explicitly
 * does not cover the refresh they trigger. Bounding the refresh here is
 * the only place that leg gets a limit.
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

/**
 * One leg to the refresh endpoint, answering `null` for anything that
 * settled without a server response. Shared by both legs so the deadline
 * covers each of them and neither can be wired to a caller's own signal.
 */
export async function postRefresh(body: object): Promise<Response | null> {
  const deadlineController = new AbortController();
  const deadlineTimeoutId = setTimeout(
    () => deadlineController.abort(),
    REFRESH_DEADLINE_MS,
  );

  try {
    return await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: deadlineController.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(deadlineTimeoutId);
  }
}

/**
 * Stores what a 2xx carried, or reports that it carried nothing readable.
 * A proxy or captive portal answering 200 with a login page reaches here,
 * and a body that will not parse establishes no more than a dead socket
 * does, so it has to leave the pair alone rather than throw out through
 * every caller waiting on this leg.
 *
 * A pair minted from a token the store has since left is the older one,
 * however late it arrives, so the answer to a slow leg cannot be written
 * over a sibling's rotation. `accountedFor` is every refresh token whose
 * presence in the store would not mean that: what it held when this leg's
 * request went out, and what that request actually spent. They are one
 * token for a renewal, which sends what it read, and two for a recovery,
 * which sends a nomination instead.
 *
 * Both are needed on the recovery. The dispatch reading alone misses what
 * the shared nomination makes possible: a sibling's rotation can be
 * answered with the very token this leg is spending, which moves the
 * store off the dispatch reading and onto a token this leg has since had
 * revoked. The store is behind this answer there, not ahead of it, and
 * discarding leaves the tab holding nothing live until its access token
 * runs out. The token sent alone is no better, since on a recovery it
 * never matches the store and would refuse every one.
 *
 * The reading is taken here rather than at the call sites so that it lands
 * after the body has parsed, leaving no await between the question and the
 * write. Only another tab can still land a write in that gap, since
 * `localStorage` has no compare-and-swap, and it is a gap of microseconds
 * against the network flight this guards.
 *
 * Discarding the pair still reports `renewed`, for the reason given above
 * the outcome type: the sibling wrote both halves, so the store is worth
 * re-reading and the request worth sending. It is the same answer the
 * refusal path reaches through the same question.
 */
export async function storeRotatedPair(
  response: Response,
  accountedFor: (string | null)[],
): Promise<RefreshOutcome> {
  try {
    const data = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    if (isRefreshTokenSuperseded(...accountedFor)) return 'renewed';
    setStoredToken(data.accessToken, data.refreshToken);
    return 'renewed';
  } catch {
    return 'unresolved';
  }
}
