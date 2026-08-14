/**
 * Renewal of an expired access token, and the question a rejected renewal
 * has to answer: is this session over, or was the rotation already taken?
 * Only the first warrants clearing the tokens, and treating the second as
 * the first is a logout the user never asked for.
 *
 * Two things take a rotation out from under a renewal. Another tab can win
 * it, and the server can commit one whose answer never arrives. The second
 * used to be unrecoverable: the successor existed only in a response that
 * was lost, so the next renewal presented a token with no row and read the
 * refusal as a dead session. It is recoverable now because the client names
 * the successor itself and stores it before the request goes out, which is
 * what `replayNominatedToken` spends.
 *
 * The sibling case needs no second network leg here: reporting success is
 * enough for `apiFetch` to retry with whatever access token the store now
 * serves. That token may still be the expired one, because the sibling's
 * two writes are not atomic (see `setStoredToken`) and its access token
 * can still be in flight. The retry then 401s and the caller sees that
 * error, which is the right outcome: one leg was spent finding out, the
 * session was never cleared, and the next request renews normally.
 *
 * The spent token is read twice, once inside the leg and once by the
 * caller, and the two readings answer to different guards. The leg reads
 * what it is about to send, so its own guard compares the store against
 * the value that request actually carried. The caller reads for a
 * different purpose: whether the pair is worth destroying. A caller that
 * starts the leg reaches both reads in one synchronous run and cannot
 * see them differ. One that joins a leg already in flight reads later,
 * so a rotation the leg's reading missed is one this reading can still
 * catch, which is the whole of what the second guard asks. Folding
 * either read into the other would put one question's answer where the
 * other one is asked.
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
  getNominatedRefreshToken,
  getStoredRefreshToken,
  isRefreshTokenSuperseded,
  nominateRefreshToken,
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
type RefreshOutcome = 'renewed' | 'refused' | 'unresolved';

let inFlightRefresh: Promise<RefreshOutcome> | null = null;
let inFlightReplay: Promise<RefreshOutcome> | null = null;

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

/**
 * One leg to the refresh endpoint, answering `null` for anything that
 * settled without a server response. Shared by both legs so the deadline
 * covers each of them and neither can be wired to a caller's own signal.
 */
async function postRefresh(body: object): Promise<Response | null> {
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
async function storeRotatedPair(
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

async function performTokenRefresh(): Promise<RefreshOutcome> {
  const spentRefreshToken = getStoredRefreshToken();

  // nothing to renew with, which is a refusal reached without a leg
  if (!spentRefreshToken) return 'refused';

  const response = await postRefresh({
    refreshToken: spentRefreshToken,
    nextRefreshToken: nominateRefreshToken(),
  });

  // no verdict keeps the tokens, and the nomination keeps its rotation
  if (!response) return 'unresolved';

  if (!response.ok) {
    // only a 401/403 can prove a token spent; others are transient
    if (response.status === 401 || response.status === 403) {
      // the successor another tab stored is live; the retry uses it
      if (isRefreshTokenSuperseded(spentRefreshToken)) return 'renewed';
      return 'refused';
    }
    return 'unresolved';
  }

  return storeRotatedPair(response, [spentRefreshToken]);
}

/**
 * The leg that spends the nominated successor, taken only once the server
 * has refused the token this client thought it held. If a rotation was
 * committed and lost, this is the token it committed to, so a refusal here
 * is the first evidence the session is actually over. It nominates nothing
 * of its own: recovering one lost answer is the job, and a chain of them
 * is a retry loop wearing a different name.
 */
async function replayNominatedToken(): Promise<RefreshOutcome> {
  const nominated = getNominatedRefreshToken();
  if (!nominated) return 'refused';

  const refreshTokenAtDispatch = getStoredRefreshToken();
  const response = await postRefresh({ refreshToken: nominated });
  if (!response) return 'unresolved';

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return 'refused';
    return 'unresolved';
  }

  return storeRotatedPair(response, [refreshTokenAtDispatch, nominated]);
}

// dedup concurrent refreshes so N parallel callers share one refresh call
function shareRefresh(): Promise<RefreshOutcome> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = performTokenRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

// a slot of its own: two callers spending the one nomination in parallel
// would leave the loser reading its own 401 as a dead session
function shareReplay(): Promise<RefreshOutcome> {
  if (inFlightReplay) return inFlightReplay;
  inFlightReplay = replayNominatedToken().finally(() => {
    inFlightReplay = null;
  });
  return inFlightReplay;
}

/**
 * Renewal for a caller whose access token the server has just refused,
 * answering whether the request is worth retrying. A refusal here is the
 * end of the session, because both halves of the pair have now been
 * turned away, but only once the nominated successor has been offered
 * too: a rotation whose answer was lost leaves this client holding a spent
 * token and a live one, and refusing the spent one says nothing about the
 * other. Two legs at most.
 *
 * The store having moved off the token this caller spent outranks both
 * verdicts, which is why the clear is guarded here rather than inside
 * either leg. A nomination lives in `localStorage`, so tabs share one while
 * the deduping above is per tab: two of them can spend it, and the server
 * rotates it for whichever arrives first. The loser is then refused on a
 * successor that is live and already stored, and clearing would destroy the
 * pair the winner just recovered.
 *
 * The question is asked of the spent token and not of the nomination. A
 * session that really has ended still holds the token it spent, which
 * differs from the nomination, so a guard asked about the nomination would
 * answer "superseded" every time and never clear anything.
 */
export async function attemptTokenRefresh(): Promise<boolean> {
  const spentRefreshToken = getStoredRefreshToken();
  let outcome = await shareRefresh();
  if (outcome === 'refused') outcome = await shareReplay();
  if (outcome === 'refused' && isRefreshTokenSuperseded(spentRefreshToken)) {
    outcome = 'renewed';
  }
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
