/**
 * The browser extension's PKCE grant, as the web app sees it.
 *
 * A `fetch` rather than a top-level navigation at the API, for the reason
 * `initiateOAuthLink` gives: the endpoint is guarded by a session JWT, and
 * only a request the app builds itself can carry one. The server answers
 * with the extension's callback URL, code appended, and the caller
 * navigates to that.
 *
 * The auth context is open to the caller, which no other client here
 * needs. A consent screen names the account it is about to grant on, so
 * it has to send the one token it checked rather than whichever the
 * store holds by the time the request is built: a literal suppresses the
 * renewal and the retry, and both of those can substitute a sibling
 * tab's token for the one that was verified.
 */

import { apiFetchRequired } from './core';
import type { AuthContext } from './core';

export async function authorizeExtension(
  codeChallenge: string,
  redirectUri: string,
  authContext?: AuthContext,
): Promise<{ redirectUrl: string }> {
  return apiFetchRequired<{ redirectUrl: string }>(
    '/auth/extension/authorize',
    {
      body: JSON.stringify({ codeChallenge, redirectUri }),
      method: 'POST',
    },
    authContext,
  );
}
